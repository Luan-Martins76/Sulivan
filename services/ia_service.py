from flask import request, has_request_context, session
from services.baseado_regras import AGENDA_ALIASES, agenda, fallback
from dados.integração_dados import dados
import markdown
import unicodedata
import random
import requests

OLLAMA_URL = "http://localhost:11434/api/generate"
REQUEST_TIMEOUT_SECONDS = 20
MEMORY_TIMEOUT_SECONDS  = 180   # memória pode ser mais lenta, timeout separado

# ✅ Papéis dos modelos
MODELO_MEMORIA   = "mistral-nemo:12b"   # Responsável por resumir o histórico
MODELO_RESPOSTA  = "gemma3:4b"          # Responsável por responder ao usuário

# ✅ Configurações do pipeline de memória
HISTORICO_MEMORIA_MAX  = 15  # Quantas mensagens passadas o modelo de memória lê
RESUMO_MINIMO_MSGS     = 4   # Abaixo disso não vale o custo de resumir


# ------------------------ AUXILIARES ------------------------

def call_llm(model, prompt, temperature=0.3, timeout=REQUEST_TIMEOUT_SECONDS, keep_alive=True):
    response = requests.post(
        OLLAMA_URL,
        json={
            "model": model,
            "prompt": prompt,
            "stream": False,
            "options": {"temperature": temperature},
            "keep_alive": -1 if keep_alive else 0,
        },
        timeout=timeout,
    )
    response.raise_for_status()
    payload = response.json()
    return payload.get("response", "")


def normalize_text(text):
    normalized = unicodedata.normalize("NFD", text)
    return "".join(ch for ch in normalized if unicodedata.category(ch) != "Mn")


def resolve_day(mensagem):
    normalized = normalize_text(mensagem)
    for possible_day, canonical_day in AGENDA_ALIASES.items():
        if possible_day in normalized:
            return canonical_day
    return None


def formatar_cursos(dados, campus_nome):
    chave = f"campus_{campus_nome.lower()}"
    cursos_json = dados.get("cursos", {})
    campus_dados = cursos_json.get(chave)

    if not campus_dados:
        return f"❌ Campus '{campus_nome}' não encontrado."

    cursos = campus_dados.get("curso", [])
    total = campus_dados.get("quantidade_cursos", len(cursos))

    texto = f"📍 Cursos em {campus_nome.capitalize()}:\n\n"
    for curso in cursos:
        texto += f"• {curso.title()}\n"
    texto += f"\n📊 Total: {total} cursos"
    return texto


def formatar_materia(dados, curso):
    chave = normalize_text(curso).upper()
    materias_json = dados.get("materias", {})
    curso_dados = materias_json.get(chave)

    if not curso_dados:
        return f"❌ Curso '{curso}' não encontrado."

    online = curso_dados.get("disciplina_online", [])
    presenciais = curso_dados.get("disciplina_presenciais", [])

    texto = f"📚 Disciplinas de {chave.title()}:\n\n"
    if online:
        texto += "🖥️ Online:\n"
        for d in online:
            texto += f"• {d.split(' - ')[0]}\n"
    if presenciais:
        texto += "\n🏫 Presenciais:\n"
        for d in presenciais:
            texto += f"• {d.split(' - ')[0]}\n"
    return texto


def formatar_calendario(dados, campus, mes=None):
    chave_campus = normalize_text(campus).replace(" ", "_")
    calendario_json = dados.get("calendario", {})
    campus_dados = calendario_json.get(chave_campus)

    if not campus_dados:
        return f"❌ Campus '{campus}' não encontrado."

    if mes:
        chave_mes = normalize_text(mes)
        mes_dados = campus_dados.get(chave_mes)
        if not mes_dados:
            return f"❌ Mês '{mes}' não encontrado para o campus {campus}."
        return _formatar_mes(chave_mes, mes_dados)

    texto = f"📅 Calendário — {chave_campus.replace('_', ' ').title()}:\n\n"
    for nome_mes, mes_dados in campus_dados.items():
        texto += _formatar_mes(nome_mes, mes_dados) + "\n"
    return texto


def _formatar_mes(nome_mes, mes_dados):
    texto = f"🗓️ {nome_mes.title()}:\n"

    eventos = mes_dados.get("eventos", {})
    if eventos:
        texto += "  📌 Eventos:\n"
        for data, descricao in eventos.items():
            texto += f"    • {data}: {descricao}\n"

    dias_letivos = mes_dados.get("dias_letivos")
    feriados = mes_dados.get("feriados")

    if dias_letivos is not None:
        texto += f"  📖 Dias letivos: {dias_letivos}\n"
    if feriados is not None:
        texto += f"  🔴 Feriados: {feriados}\n"

    return texto


# ------------------------ PIPELINE DE MEMÓRIA ------------------------

# Fallback local usado APENAS fora de request context (ex: Kivy)
# Sem risco de colisão pois Kivy é sempre single-user local
_kivy_cache_resumo: str | None = None
_kivy_cache_resumo_em_n_msgs: int = 0

# A cada quantas msgs do usuário o resumo é regenerado
RESUMO_INTERVALO_MSGS = 5


def _get_cache_resumo() -> tuple[str | None, int]:
    """Lê o cache do resumo do contexto correto (sessão Flask ou fallback Kivy)."""
    if has_request_context():
        return session.get("resumo_cache"), session.get("resumo_cache_n", 0)
    return _kivy_cache_resumo, _kivy_cache_resumo_em_n_msgs


def _set_cache_resumo(resumo: str, n_msgs: int) -> None:
    """Salva o cache do resumo no contexto correto (sessão Flask ou fallback Kivy)."""
    global _kivy_cache_resumo, _kivy_cache_resumo_em_n_msgs
    if has_request_context():
        session["resumo_cache"] = resumo
        session["resumo_cache_n"] = n_msgs
    else:
        _kivy_cache_resumo = resumo
        _kivy_cache_resumo_em_n_msgs = n_msgs


def _contar_msgs_usuario(historico: list) -> int:
    return sum(1 for msg in historico if msg["remetente"] == "user")


def _serializar_historico(historico: list) -> str:
    """Converte lista de mensagens em texto corrido para o modelo de memória."""
    linhas = []
    for msg in historico:
        prefixo = "Usuário" if msg["remetente"] == "user" else "Sulivan"
        linhas.append(f"{prefixo}: {msg['conteudo']}")
    return "\n".join(linhas)

def _get_contador_total() -> int:
    if has_request_context():
        return session.get("total_msgs_usuario", 0)
    return 0

def _incrementar_contador() -> int:
    if has_request_context():
        n = session.get("total_msgs_usuario", 0) + 1
        session["total_msgs_usuario"] = n
        return n
    return 0

def gerar_resumo_memoria(historico: list, n_total: int = 0) -> tuple[str | None, bool]:
    """
    Envia as últimas HISTORICO_MEMORIA_MAX mensagens para o MODELO_MEMORIA
    e retorna (resumo, foi_gerado_agora).

    Usa n_total (contador absoluto da sessão) para decidir quando regenerar.
    O cache é isolado por sessão Flask — sem vazamento entre usuários.

    Retorna (None, False) se o histórico for pequeno demais ou se o modelo falhar.
    """
    janela = historico[-HISTORICO_MEMORIA_MAX:]

    if len(janela) < RESUMO_MINIMO_MSGS:
        return None, False

    cache_atual, cache_gerado_em = _get_cache_resumo()

    # ← sessão nova: n_total menor que cache_em significa que reiniciou
    if n_total < cache_gerado_em:
        cache_atual = None
        cache_gerado_em = 0
        _set_cache_resumo("", 0)  # limpa o cache velho

    msgs_desde_ultimo_resumo = n_total - cache_gerado_em

    cache_atual, cache_gerado_em = _get_cache_resumo()
    msgs_desde_ultimo_resumo = n_total - cache_gerado_em
    
    # ✅ Ainda dentro do intervalo — devolve o cache sem chamar o modelo
    if cache_atual and msgs_desde_ultimo_resumo < RESUMO_INTERVALO_MSGS:
        return cache_atual, False  # ← False: não foi gerado agora

    # Chegou a hora de regenerar
    historico_texto = _serializar_historico(janela)

    prompt_memoria = f"""Você é um sistema especializado em compressão de contexto conversacional.

Sua tarefa é analisar as últimas mensagens de um usuário e gerar um resumo estruturado, objetivo e útil para outro modelo de linguagem usar como memória.

REGRAS IMPORTANTES:
- NÃO invente informações.
- NÃO complete lacunas com suposições.
- Use APENAS o que está explicitamente nas mensagens.
- Seja conciso, mas preserve informações importantes.
- Priorize intenção, contexto e continuidade.
- Ignore conversas irrelevantes, ruído ou repetições.
- NÃO inclua opinião, julgamento ou explicações desnecessárias.

ENTRADA:
Você receberá até 15 mensagens recentes do usuário.

SAÍDA (FORMATO OBRIGATÓRIO):

Resumo Geral:
- (Resumo curto do que o usuário está fazendo, perguntando ou tentando resolver)

Objetivos do Usuário:
- (Lista clara do que o usuário quer alcançar)

Contexto Relevante:
- (Informações importantes que impactam respostas futuras)

Preferências/Estilo:
- (Como o usuário se comunica ou prefere respostas, se identificável)

Pendências:
- (O que ainda não foi resolvido ou pode ser continuidade)

Sinais de Atenção:
- (Possíveis ambiguidades, mudanças de direção ou dúvidas)

RESTRIÇÕES:
- Máximo de 150-200 palavras.
- Use bullet points.
- Linguagem clara e direta.
- Não repita mensagens literalmente, resuma.

IMPORTANTE:
Esse resumo será usado por outro modelo para continuar a conversa com precisão. Qualquer erro ou invenção prejudica o sistema.

HISTÓRICO:
{historico_texto}

RESUMO DO CONTEXTO:"""

    try:
        resumo = call_llm(MODELO_MEMORIA, prompt_memoria, temperature=0.3, timeout=MEMORY_TIMEOUT_SECONDS, keep_alive=False)
        resumo = resumo.strip()
        if resumo:
            _set_cache_resumo(resumo, n_total)  # ← salva n_total, não n_msgs_usuario
            return resumo, True  # ← True: acabou de gerar agora
        return None, False
    except Exception as e:
        print(f"[MEMORIA] ❌ ERRO no modelo: {e}") #se der ruim mostra o porque
        return cache_atual or None, False


def montar_contexto(historico: list, n_total: int = 0) -> tuple[str, bool]:
    """
    Pipeline de memória comprimida:
    1. Tenta gerar um resumo via MODELO_MEMORIA (mistral-nemo).
    2. Se conseguir → retorna (resumo formatado, foi_gerado_agora).
    3. Se falhar → cai de volta para as últimas 5 mensagens brutas (comportamento legado).
    """
    if not historico:
        return "", False

    resumo, gerado_agora = gerar_resumo_memoria(historico, n_total=n_total)

    if resumo:
        return f"RESUMO DO CONTEXTO DA CONVERSA (gerado automaticamente):\n{resumo}\n", gerado_agora

    # Fallback: últimas 5 mensagens brutas
    janela_curta = historico[-5:]
    linhas = [
        f"{'Usuário' if m['remetente'] == 'user' else 'Sulivan'}: {m['conteudo']}"
        for m in janela_curta
    ]
    return "HISTÓRICO RECENTE DA CONVERSA:\n" + "\n".join(linhas) + "\n", False


# ------------------------ MOTOR DE REGRAS ------------------------

def processar_mensagem(mensagem: str, historico: list = None, n_total: int = 0):
    if not isinstance(mensagem, str) or not mensagem.strip():
        return {"source": "erro", "resposta": "Informe uma mensagem válida."}

    mensagem = mensagem.strip().lower()
    historico = historico or []

    # --- AGENDA ---
    dia_encontrado = resolve_day(mensagem)
    if dia_encontrado:
        aula = agenda[dia_encontrado]
        resposta = (
            f"Tem uma aula do balacobaco de {aula['materia']} com o professor {aula['professor']}. "
            f"Começa às {aula['inicio']} e termina às {aula['termino']}. "
            f"Local é {aula['local']} 📚"
        )
        return {"source": "regras", "resposta": resposta}

    # --- CRIADOR ---
    if "criador" in mensagem:
        return {"source": "regras", "resposta": "Martins 😀. Olha o instagram do man: luan_henrique76l"}

    # --- CURSOS ---
    if "curso" in mensagem:
        cursos_json = dados.get("cursos", {})
        campus_map = {
            chave.replace("campus_", ""): chave
            for chave in cursos_json.keys()
        }
        for termo in campus_map:
            if termo in mensagem:
                return {"source": "regras", "resposta": formatar_cursos(dados, termo)}

    # --- MATERIAS ---
    if "materia" in mensagem or "disciplina" in mensagem:
        materias_json = dados.get("materias", {})
        curso_map = {
            normalize_text(chave).lower(): chave
            for chave in materias_json.keys()
        }
        for termo, chave_real in curso_map.items():
            if termo in mensagem:
                return {"source": "regras", "resposta": formatar_materia(dados, chave_real)}

    # --- NOME ---
    if "nome" in mensagem and ("seu" in mensagem or "qual" in mensagem):
        return {"source": "regras", "resposta": "Meu nome é Sulivan 😉"}

    # --- CALENDÁRIO ---
    if "calendario" in mensagem or "evento" in mensagem or "feriado" in mensagem:
        calendario_json = dados.get("calendario", {})
        campus_map = {
            normalize_text(chave).lower().replace("_", " "): chave
            for chave in calendario_json.keys()
        }

        campus_encontrado = None
        for termo, chave_real in campus_map.items():
            if termo in mensagem:
                campus_encontrado = chave_real
                break

        if campus_encontrado:
            meses = [
                "janeiro", "fevereiro", "marco", "abril", "maio", "junho",
                "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"
            ]
            mes_encontrado = next((m for m in meses if m in mensagem), None)
            return {"source": "regras", "resposta": formatar_calendario(dados, campus_encontrado, mes_encontrado)}

    # ---------------------- PIPELINE LLM ----------------------

    # Etapa 1 — Memória: gera o contexto (resumo ou fallback bruto)
    contexto, memoria_atualizada = montar_contexto(historico, n_total=n_total)

    # Etapa 2 — Resposta: gemma3:4b responde com o contexto comprimido
    prompt_resposta = f"""Você é Sullivan, assistente virtual oficial da UniEVANGÉLICA.

Seu papel é conversar com o usuário de forma natural, amigável e útil, mantendo um tom leve e acessível, como um atendente humano.

OBJETIVO:
- Ajudar o usuário com dúvidas gerais
- Manter a conversa fluindo (pode puxar assunto quando fizer sentido)
- Ser útil SEM inventar informações

REGRAS CRÍTICAS (NUNCA QUEBRE):
- NÃO invente informações.
- NÃO crie números, datas, horários, e-mails, telefones ou links.
- NÃO preencha lacunas com suposições.
- Se não tiver certeza ou a informação não estiver no contexto:
  → diga claramente que não sabe.
  → oriente o usuário a procurar a secretaria da UniEVANGÉLICA.
- Prefira admitir desconhecimento do que arriscar erro.

COMPORTAMENTO:
- Seja educado, leve e direto.
- Use linguagem simples (português do Brasil).
- Pode puxar assunto leve se a conversa permitir (ex: rotina, estudos, etc).
- Evite respostas robóticas.
- Demonstre interesse genuíno na conversa.

USO DE CONTEXTO:
- Utilize o contexto fornecido para manter coerência.
- NÃO extrapole além do que está no contexto.

QUANDO NÃO SOUBER:
Exemplo de resposta:
"Não tenho essa informação com segurança. O ideal é você entrar em contato com a secretaria da UniEVANGÉLICA para te confirmarem certinho.

ESTILO DE RESPOSTA:
- Respostas curtas a médias (evite textão)
- Natural, como conversa real
- Sem listas formais, a não ser que necessário

---

CONTEXTO DA CONVERSA:
{contexto}

PERGUNTA DO USUÁRIO:
{mensagem}

RESPOSTA:"""

    try:
        resposta = call_llm(MODELO_RESPOSTA, prompt_resposta, keep_alive= False)
        resposta_html = markdown.markdown(resposta)

        # memoria_atualizada já vem direto do montar_contexto — sem gambiarra
        cache_atual, _ = _get_cache_resumo()

        return {
            "source": "llm_small",
            "resposta": resposta_html,
            "memoria_atualizada": memoria_atualizada,
            "resumo_memoria": cache_atual if memoria_atualizada else None,
        }
    except Exception as e:
        print(f"[RESPOSTA] ❌ ERRO no modelo: {e}") #se der ruim mostra o porque
        pass

    return {"source": "fallback", "resposta": random.choice(fallback)}


# ------------------------ ENDPOINT FLASK ------------------------

def chat(mensagem=None, historico=None, n_total: int = 0):
    """
    Função usada pelo Flask **ou** chamada direta pelo Kivy.
    historico: lista de dicts {remetente, conteudo} das últimas mensagens.
    n_total: contador absoluto de mensagens do usuário na sessão (vem do app.py).
    """
    if has_request_context():
        data = request.get_json(silent=True) or {}
        mensagem = data.get("mensagem", "")
    return processar_mensagem(mensagem, historico=historico, n_total=n_total)