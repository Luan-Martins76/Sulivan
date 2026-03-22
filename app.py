from flask import Flask, render_template, request, jsonify
from services.ia_service import chat

app = Flask(__name__)

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