import sqlite3
import os
from werkzeug.security import generate_password_hash, check_password_hash

BANCO = os.path.join(os.path.dirname(__file__), "..", "dados", "usuarios.db")


def _conectar():
    """Abre conexão com o banco e garante que a tabela existe."""
    os.makedirs(os.path.dirname(BANCO), exist_ok=True)
    conn = sqlite3.connect(BANCO)
    conn.row_factory = sqlite3.Row  # permite acessar colunas por nome: row["email"]
    conn.execute("""
        CREATE TABLE IF NOT EXISTS usuarios (
            id        INTEGER  PRIMARY KEY AUTOINCREMENT,
            nome      TEXT     NOT NULL,
            email     TEXT     NOT NULL UNIQUE,
            senha     TEXT     NOT NULL,
            criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.commit()
    return conn


def validar_usuario(email, password):
    """
    Verifica se o email existe e se a senha está correta.
    Retorna o usuário (dict) se válido, ou None se inválido.
    """
    conn = _conectar()
    try:
        usuario = conn.execute(
            "SELECT * FROM usuarios WHERE email = ?", (email.lower(),)
        ).fetchone()

        if usuario and check_password_hash(usuario["senha"], password):
            return dict(usuario)  # converte Row para dict normal

        return None
    finally:
        conn.close()


def criar_conta(nome, email, password):
    """
    Cria um novo usuário no banco.
    Retorna (True, usuario) se criado com sucesso.
    Retorna (False, mensagem_de_erro) se o email já existe.
    """
    conn = _conectar()
    try:
        conn.execute(
            "INSERT INTO usuarios (nome, email, senha) VALUES (?, ?, ?)",
            (nome, email.lower(), generate_password_hash(password))
        )
        conn.commit()

        usuario = conn.execute(
            "SELECT * FROM usuarios WHERE email = ?", (email.lower(),)
        ).fetchone()

        return True, dict(usuario)

    except sqlite3.IntegrityError:
        # UNIQUE constraint falhou = email já cadastrado
        return False, "Email já cadastrado"

    finally:
        conn.close()
