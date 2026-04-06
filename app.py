from flask import Flask, render_template, request, jsonify, session
from services.ia_service import chat
from login.logica_login import validar_usuario, criar_conta

app = Flask(__name__)
app.secret_key = "sulivan_chave_secreta_2026"  # troque por algo mais seguro em produção


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

    return jsonify({"erro": resultado}), 409  # 409 = Conflict (email já existe)


@app.route("/logout", methods=["POST"])
def logout():
    session.clear()
    return jsonify({"status": "ok"})


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/health", methods=["GET"])
def healthcheck():
    return jsonify({"status": "ok"})


@app.route("/chat", methods=["POST"])
def chat_endpoint():
    mensagem = request.json.get("mensagem")
    resposta = chat(mensagem)
    return jsonify({"response": resposta})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
