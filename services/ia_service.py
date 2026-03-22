from flask import Flask, render_template, request, jsonify
from services.baseado_regras import AGENDA_ALIASES, contadores, agenda, fallback
from dados.integração_dados import dados

import requests
import markdown
import random
import unicodedata

OLLAMA_URL = "http://localhost:11434/api/generate"
REQUEST_TIMEOUT_SECONDS = 20

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

    llm_response = payload.get("response")
    if not llm_response:
        raise ValueError("Ollama retornou resposta vazia")

    return llm_response

def formatar_cursos(dados, campus):
    chave = f"campus_{campus.lower()}"

    campus_dados = dados["cursos"].get(chave)

    if not campus_dados:
        return f"❌ Campus '{campus}' não encontrado."

    cursos = campus_dados["curso"]
    total = campus_dados["quantidade_cursos"]

    nome_campus = campus.capitalize()

    texto = f"📍 Cursos em {nome_campus}:\n\n"

    for curso in cursos:
        texto += f"• {curso.title()}\n"

    texto += f"\n📊 Total: {total} cursos"

    return texto

def normalize_text(text):
    normalized = unicodedata.normalize("NFD", text)
    return "".join(ch for ch in normalized if unicodedata.category(ch) != "Mn")

def resolve_day(mensagem):
    normalized = normalize_text(mensagem)
    for possible_day, canonical_day in AGENDA_ALIASES.items():
        if possible_day in normalized:
            return canonical_day
    return None

def chat(mensagem):
    data = request.get_json(silent=True) or {}
    mensagem = data.get("mensagem", "")

    if not isinstance(mensagem, str) or not mensagem.strip():
        return {"erro": "Informe uma mensagem válida."}, 400

    mensagem = mensagem.strip().lower()

    contadores["total"] += 1
    resposta = ""
    respondeu = False

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
        respondeu = True

    elif "criador" in mensagem:
        resposta = "Martins 😀. Olha o instagram do man: luan_henrique76l"
        respondeu = True

    elif "curso" in mensagem and "anapolis" in mensagem:
        resposta = formatar_cursos(dados, "anapolis")
        respondeu = True

    elif "curso" in mensagem and "ceres" in mensagem:
        resposta = formatar_cursos(dados, "ceres")
        respondeu = True

    elif "curso" in mensagem and "jaragua" in mensagem:
        resposta = formatar_cursos(dados, "jaragua")
        respondeu = True

    elif "curso" in mensagem and "rubiataba" in mensagem:
        resposta = formatar_cursos(dados, "rubiataba")
        respondeu = True

    elif "curso" in mensagem and "senador canedo" in mensagem:
        resposta = formatar_cursos(dados, "senador_canedo")
        respondeu = True
    
    elif "curso" in mensagem and "acdoc" in mensagem:
        respondeu = formatar_cursos(dados, "acdoc")
        respondeu = True

    elif "curso" in mensagem and "capelania" in mensagem:
        resposta = formatar_cursos(dados, "capelania")
        respondeu = True

    elif "nome" in mensagem and ("seu" in mensagem or "qual" in mensagem):
        contadores["meu_nome"] += 1
        if contadores["meu_nome"] >= 4:
            resposta = "Skynet 🤖"
        elif contadores["meu_nome"] == 3:
            resposta = "Acho que eu escolhi outro... 😑"
        else:
            resposta = "Meu nome é Lionel No IT 😉"
        respondeu = True

    elif "calculadora" in mensagem:
        contadores["calculadora"] += 1
        resposta = "Calculadora? Cara, tem uma no seu celular... Mas tudo bem, me manda os números e a operação (+, -, *, /) 🧮"
        respondeu = True

    elif mensagem in ["sair", "tchau", "bye", "falou"]:
        resposta = "Falou man 👋 Até mais!"
        respondeu = True

    if not respondeu:
        for model_name, source_name in (("gemma3:4b", "llm_small"), ("mistral-nemo:12b", "llm_big")):
            try:

                prompt = f"""
Você é Lionel No IT, um assistente virtual da instituição UniEvangelica.

Seu papel é conversar com alunos de forma educada e simples.

IMPORTANTE:
Você NÃO possui acesso a bancos de dados institucionais.
Você NÃO pode inventar informações sobre a instituição.

Regras obrigatórias:
- Nunca invente dados institucionais.
- Nunca crie horários, nomes de professores ou locais.
- Se a pergunta exigir informação institucional específica, responda que não possui essa informação.
- Em caso de dúvida, oriente o usuário a procurar a secretaria da instituição.
- Seja educado, claro e direto.

Você pode responder normalmente apenas perguntas gerais ou conversas simples.

Pergunta do usuário:
{mensagem}

Resposta:
"""

                
                resposta = call_llm(model_name, prompt)
                resposta_html = markdown.markdown(resposta)
                return {"source": source_name, "resposta": resposta_html}
            except Exception:
                continue

        resposta = random.choice(fallback)
        return {"source": "fallback", "resposta": resposta}

    return {"source": "regras", "resposta": resposta}