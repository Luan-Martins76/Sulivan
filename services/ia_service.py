from flask import request, has_request_context
from services.baseado_regras import AGENDA_ALIASES, contadores, agenda, fallback
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


# ------------------------ MOTOR DE REGRAS ------------------------

def processar_mensagem(mensagem: str, historico: list = None):
    if not isinstance(mensagem, str) or not mensagem.strip():
        return {"source": "erro", "resposta": "Informe uma mensagem válida."}

    mensagem = mensagem.strip().lower()
    historico = historico or []
    contadores["total"] += 1

    # --- AGENDA ---
    dia_encontrado = resolve_day(mensagem)
    if dia_encontrado:
        aula = agenda[dia_encontrado]
        contadores["dia"] += 1

        if contadores["dia"] == 4:
            resposta = "🥴 Tá bom, tá bom... VOCÊ venceu, parabéns? 🤨 Vou responder só o que o Martins falou para eu fazer 🤡"
        elif contadores["dia"] == 3:
            resposta = "É uma aula só que tu vai ter hoje seu maldito! Tá me perguntando os dias tudo porque? 🤨"
        else:
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
        contadores["meu_nome"] += 1
        if contadores["meu_nome"] >= 4:
            return {"source": "regras", "resposta": "Skynet 🤖"}
        elif contadores["meu_nome"] == 3:
            return {"source": "regras", "resposta": "Acho que eu escolhi outro... 😑"}
        else:
            return {"source": "regras", "resposta": "Meu nome é Lionel No IT 😉"}

    # --- CALCULADORA ---
    if "calculadora" in mensagem:
        contadores["calculadora"] += 1
        return {
            "source": "regras",
            "resposta": "Calculadora? Cara, tem uma no seu celular... Mas tudo bem, me manda os números e a operação (+, -, *, /) 🧮"
        }

    # --- SAIR ---
    if mensagem in ["sair", "tchau", "bye", "falou"]:
        return {"source": "regras", "resposta": "Falou man 👋 Até mais!"}

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
