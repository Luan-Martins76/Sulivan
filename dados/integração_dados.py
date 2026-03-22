import json

def carregar_json(caminho):
    with open(caminho, 'r', encoding='utf-8') as f:
        return json.load(f)
    
dados = {
    "institucional": carregar_json("dados/institucional.json"),
    "cursos": carregar_json("dados/cursos.json"),
    "professores": carregar_json("dados/professores.json"),
    "materias": carregar_json("dados/materias.json"),
    "secretaria": carregar_json("dados/secretaria.json"),
    "calendario": carregar_json("dados/calendario.json"),
}