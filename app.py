from flask import Flask, render_template, request, jsonify, session, redirect
from dotenv import load_dotenv
from services.ia_service import chat
from login.logica_login import (
    validar_usuario,
    criar_conta,
    salvar_mensagem,
    carregar_historico,
    limpar_historico,
)
import os

load_dotenv()

app = Flask(__name__)
app.secret_key = os.getenv("SECRET_KEY")


@app.route("/login", methods=["POST"])
def login():
    data = request.get_json()

    if not data or not data.get("email") or not data.get("password"):
        return jsonify({"erro": "Email e senha são obrigatórios"}), 400

    user = validar_usuario(data["email"], data["password"])

    if user:
        session["user_id"] = user["id"]
        session["user_nome"] = user["nome"]
        return jsonify({"status": "ok", "nome": user["nome"]})

    return jsonify({"erro": "Email ou senha inválidos"}), 401

@app.route("/cookie")
def cookie():
    return render_template("cookie_chat.html")



@app.route("/cadastro", methods=["POST"])
def cadastro():
    data = request.get_json()

    if not data or not data.get("nome") or not data.get("email") or not data.get("password"):
        return jsonify({"erro": "Nome, email e senha são obrigatórios"}), 400

    sucesso, resultado = criar_conta(data["nome"], data["email"], data["password"])

    if sucesso:
        session["user_id"] = resultado["id"]
        session["user_nome"] = resultado["nome"]
        return jsonify({"status": "ok", "nome": resultado["nome"]})

    return jsonify({"erro": resultado}), 409


@app.route("/logout", methods=["POST"])
def logout():
    session.clear()
    return jsonify({"status": "ok"})


@app.route("/")
def index():
    return render_template("login.html")

@app.route("/index")
def painel():
    if "user_id" not in session:
        return redirect("/")
    return render_template("index.html")


@app.route("/health", methods=["GET"])
def healthcheck():
    return jsonify({"status": "ok"})


@app.route("/chat", methods=["POST"])
def chat_endpoint():
    mensagem = request.json.get("mensagem")
    usuario_id = session.get("user_id")

    # Busca as últimas 15 mensagens para o pipeline de memória
    historico = carregar_historico(usuario_id, limite=15) if usuario_id else []

    resposta_dict = chat(mensagem, historico=historico)
    resposta = resposta_dict["resposta"] if isinstance(resposta_dict, dict) else resposta_dict

    # Persiste a troca se o usuário estiver logado
    if usuario_id:
        salvar_mensagem(usuario_id, "user", mensagem)
        salvar_mensagem(usuario_id, "bot", resposta)

    return jsonify({
        "response": resposta,
        "source": resposta_dict.get("source"),
        "memoria_atualizada": resposta_dict.get("memoria_atualizada", False),
        "resumo_memoria": resposta_dict.get("resumo_memoria"),
    })


# ─────────────────────────────────────────────
# ✅ NOVOS ENDPOINTS DE HISTÓRICO
# ─────────────────────────────────────────────

@app.route("/historico", methods=["GET"])
def historico():
    """Retorna o histórico de mensagens do usuário logado."""
    usuario_id = session.get("user_id")
    if not usuario_id:
        return jsonify({"erro": "Não autenticado"}), 401

    mensagens = carregar_historico(usuario_id)
    return jsonify({"mensagens": mensagens})


@app.route("/historico", methods=["DELETE"])
def deletar_historico():
    """Apaga todo o histórico do usuário logado."""
    usuario_id = session.get("user_id")
    if not usuario_id:
        return jsonify({"erro": "Não autenticado"}), 401

    limpar_historico(usuario_id)
    return jsonify({"status": "ok"})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
