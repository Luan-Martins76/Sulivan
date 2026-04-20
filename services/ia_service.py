from flask import request, has_request_context
from services.baseado_regras import AGENDA_ALIASES, agenda, fallback
from dados.integração_dados import dados
import markdown
import unicodedata
import random
import requests

OLLAMA_URL = "http://localhost:11434/api/generate"
REQUEST_TIMEOUT_SECONDS = 20


# ------------------------ AUXILIARES ------------------------

def call_llm(model, prompt, temperature=0.3):
    response = requests.post(
        OLLAMA_URL,
        json={
            "model": model,
            "prompt": prompt,
            "stream": False,
            "options": {"temperature": temperature},
        },
        timeout=REQUEST_TIMEOUT_SECONDS,
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


# ✅ Monta o bloco de contexto a partir do histórico
def montar_contexto(historico: list) -> str:
    if not historico:
        return ""

    linhas = []
    for msg in historico:
        prefixo = "Usuário" if msg["remetente"] == "user" else "Sulivan"
        linhas.append(f"{prefixo}: {msg['conteudo']}")

    return "HISTÓRICO RECENTE DA CONVERSA:\n" + "\n".join(linhas) + "\n"


def formatar_calendario(dados, campus, mes=None):
    chave_campus = normalize_text(campus).replace(" ", "_")
    calendario_json = dados.get("calendario", {})
    campus_dados = calendario_json.get(chave_campus)

    if not campus_dados:
        return f"❌ Campus '{campus}' não encontrado."

    # Se um mês específico foi pedido
    if mes:
        chave_mes = normalize_text(mes)
        mes_dados = campus_dados.get(chave_mes)
        if not mes_dados:
            return f"❌ Mês '{mes}' não encontrado para o campus {campus}."
        return _formatar_mes(chave_mes, mes_dados)

    # Se não, retorna o ano todo
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

# ------------------------ MOTOR DE REGRAS ------------------------

def processar_mensagem(mensagem: str, historico: list = None):
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

    
    # --- calendario ---
    if "calendario" in mensagem or "evento" in mensagem or "feriado" in mensagem:
        calendario_json = dados.get("calendario", {})
        campus_map = {
            normalize_text(chave).lower().replace("_", " "): chave  # 👈 underscore vira espaço
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

    # ---------------------- MODELOS LLM ----------------------

    # ✅ Monta contexto com as últimas mensagens antes de chamar o LLM
    contexto = montar_contexto(historico)

    for model_name, source_name in (
        ("gemma3:4b", "llm_small"),
        ("mistral-nemo:12b", "llm_big"),
    ):
        try:
            prompt = f"""Você é Sulivan, assistente virtual oficial da UniEVANGÉLICA.

REGRAS IMPORTANTES:
- Responda apenas com informações seguras e verificadas.
- NÃO invente informações.
- NÃO adivinhe respostas.
- Se não souber, diga claramente que não tem essa informação.
- Se o aluno já perguntou algo antes, use o histórico para dar respostas coerentes.

QUANDO TIVER DÚVIDA:
- Oriente o aluno a procurar a secretaria da UniEVANGÉLICA.

COMPORTAMENTO:
- Seja educado, claro e direto.
- Use linguagem simples.
- Responda em português do Brasil.

{contexto}
Pergunta atual do usuário:
{mensagem}

Resposta:
"""
            resposta = call_llm(model_name, prompt)
            resposta_html = markdown.markdown(resposta)
            return {"source": source_name, "resposta": resposta_html}
        except Exception:
            pass

    return {"source": "fallback", "resposta": random.choice(fallback)}


# ------------------------ ENDPOINT FLASK ------------------------

def chat(mensagem=None, historico=None):
    """
    Função usada pelo Flask **ou** chamada direta pelo Kivy.
    historico: lista de dicts {remetente, conteudo} das últimas mensagens.
    """
    if has_request_context():
        data = request.get_json(silent=True) or {}
        mensagem = data.get("mensagem", "")
    return processar_mensagem(mensagem, historico=historico)
