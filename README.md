# 📄 Documentação Técnica — Lionel No IT (MVP)

**Projeto:** Sulivan — Chatbot Institucional UniEVANGÉLICA  
**Versão:** MVP (Clean Architecture v2)  
**Autores:** 
*Luan Henrique (Martins)*
*Gabriel Silveira*
*Marcos*
*Maria julia*
*Pedro Augusto*
*João Victor*
*Emily Alves*


**Data:** Março / 2026  

---

## 1. Visão Geral

O **Sulivan** é um assistente virtual desenvolvido para a **Universidade Evangélica de Goiás (UniEVANGÉLICA)**. Seu objetivo é responder perguntas de alunos sobre horários de aula, cursos disponíveis por campus e informações gerais da instituição, com uma personalidade bem-humorada e acessível.

O sistema combina um **agente baseado em regras** (respostas rápidas e determinísticas) com um **fallback via LLM local** (Ollama), garantindo respostas mesmo para perguntas fora do escopo pré-definido.

---

## 2. Arquitetura

O projeto segue os princípios da **Clean Architecture**, separando as responsabilidades em camadas distintas:

```
Layonel_No_IT_CleanArchitecture/
│
├── app.py                        # Camada de entrada — servidor Flask e rotas HTTP
│
├── services/
│   ├── ia_service.py             # Camada de aplicação — lógica principal do chat
│   └── baseado_regras.py         # Camada de domínio — regras, agenda e fallbacks
│
├── dados/
│   ├── integração_dados.py       # Carregamento dos dados JSON
│   ├── institucional.json        # Dados da instituição (missão, visão, história)
│   ├── cursos.json               # Cursos por campus
│   ├── professores.json          # Professores
│   ├── materias.json             # Matérias
│   ├── secretaria.json           # Dados da secretaria
│   └── calendario.json           # Calendário acadêmico
│
├── templates/
│   └── index.html                # Frontend da aplicação (chat UI)
│
└── tests/
    ├── interface.html            # Interface de teste manual
    └── test_app.py               # Testes automatizados (unittest)
```

### Fluxo de uma Requisição

```
Usuário (browser)
     │
     ▼
  index.html  ──── POST /chat ────▶  app.py (Flask)
                                          │
                                          ▼
                                   ia_service.chat()
                                          │
                          ┌───────────────┴───────────────┐
                          │                               │
                   Regra encontrada?               Nenhuma regra
                          │                               │
                    Responde via                  Tenta LLM (Ollama)
                   baseado_regras                    gemma3:4b
                          │                       mistral-nemo:12b
                          │                               │
                          │                       Falha? → fallback()
                          │                               │
                          └───────────────┬───────────────┘
                                          │
                                   JSON de resposta
                                   { source, resposta }
```

---

## 3. Componentes

### 3.1 `app.py` — Servidor Flask

Ponto de entrada da aplicação. Define três rotas HTTP:

| Rota | Método | Descrição |
|------|--------|-----------|
| `/` | GET | Serve a interface web (index.html) |
| `/health` | GET | Healthcheck — retorna `{"status": "ok"}` |
| `/chat` | POST | Recebe `{"mensagem": "..."}` e retorna a resposta do bot |

**Execução padrão:** host `0.0.0.0`, porta `5000`, modo debug ativo.

---

### 3.2 `services/baseado_regras.py` — Camada de Domínio

Define os dados estáticos e regras de negócio:

**`agenda`** — Horários de aula por dia da semana (segunda a sábado):

| Dia | Matéria | Professor | Horário | Local |
|-----|---------|-----------|---------|-------|
| Segunda | Fundamentos de Engenharia de Dados | Eduardo | 19h–21h50 | Bloco H, Sala 110 |
| Terça | Fundamentos Matemáticos para Computação | Otoniel | 19h–21h50 | Bloco H, Sala 110 |
| Quarta | Introdução à Engenharia de Soluções | Henrique Lima | 19h–22h40 | Bloco H, Sala 110 |
| Quinta | Cidadania, Ética e Espiritualidade | Helehon Santos | 19h–21h40 | Bloco H, Sala 110 |
| Sexta | Fundamento de Computação e Infraestrutura | Araújo | 19h–21h40 | Bloco H, Sala 110 |
| Sábado | Leitura e Interpretação de Texto (Online) | Autodidata | Livre | Casa |

**`AGENDA_ALIASES`** — Mapa de variações textuais para os dias canônicos (ex.: `"terca"` → `"terça"`).

**`contadores`** — Dicionário de contadores para rastrear quantas vezes o usuário fez perguntas similares, habilitando respostas progressivamente mais irônicas:

```python
contadores = { "total": 0, "else": 0, "dia": 0, "meu_nome": 0, "calculadora": 0 }
```

**`fallback`** — Lista com ~20 respostas humorísticas para perguntas fora do escopo.

---

### 3.3 `services/ia_service.py` — Camada de Aplicação

Contém toda a lógica do chat. Funções principais:

#### `chat(mensagem)`
Função central. Processa a mensagem do usuário e retorna um JSON com:
- `source`: indica a origem da resposta (`"regras"`, `"llm_small"`, `"llm_big"`, `"fallback"`)
- `resposta`: texto da resposta

**Lógica de despacho (em ordem de prioridade):**

1. Detecta dia da semana na mensagem → retorna horário da agenda
2. Detecta palavra-chave `"criador"` → retorna crédito ao autor
3. Detecta `"curso"` + nome do campus → retorna lista de cursos
4. Detecta `"nome"` + `"seu"/"qual"` → retorna nome do bot (com escalonamento irônico)
5. Detecta `"calculadora"` → resposta humorística
6. Detecta saudações de saída → encerra com estilo
7. Nenhuma regra matched → tenta LLM via Ollama

#### `call_llm(model, prompt, temperature=0.3)`
Faz requisição POST para a API local do Ollama (`http://localhost:11434/api/generate`). Timeout de 20 segundos. Retorna o texto gerado pelo modelo.

#### `formatar_cursos(dados, campus)`
Formata a lista de cursos de um campus específico. Aceita as chaves: `anapolis`, `ceres`, `jaragua`, `rubiataba`, `senador_canedo`, `acdoc`, `capelania`.

#### `normalize_text(text)` e `resolve_day(mensagem)`
Normalizam e identificam dias da semana na mensagem, removendo acentos para garantir detecção robusta (ex.: "terça" = "terca").

---

### 3.4 `dados/` — Camada de Dados

Todos os dados são carregados via `integração_dados.py` no startup:

```python
dados = {
    "institucional": carregar_json("dados/institucional.json"),
    "cursos":        carregar_json("dados/cursos.json"),
    "professores":   carregar_json("dados/professores.json"),
    "materias":      carregar_json("dados/materias.json"),
    "secretaria":    carregar_json("dados/secretaria.json"),
    "calendario":    carregar_json("dados/calendario.json"),
}
```

**`institucional.json`** contém: `quem_somos`, `missao`, `visao`, `valores`, `historia` (de 1947 a 2021), `reitoria`, `pro_reitor`, `pro_reitoria_pos_graduacao`.

**`cursos.json`** contém cursos agrupados por campus: Anápolis, Ceres, Jaraguá, Rubiataba, Senador Canedo, além de ACDOC, Capelania, Centro de Línguas, Cursos Livres, Graduação, Pós-Graduação Lato e Stricto Sensu.

---

### 3.5 `templates/index.html` — Frontend

Interface web do chatbot (single-page, sem framework). Renderizada diretamente pelo Flask via `render_template`.

---

### 3.6 `tests/test_app.py` — Testes Automatizados

Três casos de teste usando `unittest` e o test client do Flask:

| Teste | Descrição |
|-------|-----------|
| `test_chat_rejects_empty_message` | Verifica que mensagens vazias retornam HTTP 400 com mensagem de erro |
| `test_chat_handles_day_without_accent` | Verifica detecção de dia sem acento ("terca") e retorno correto da matéria |
| `test_healthcheck` | Verifica que `/health` retorna 200 com `{"status": "ok"}` |

---

## 4. Integração com LLM (Ollama)

Quando nenhuma regra pré-definida cobre a pergunta, o sistema tenta dois modelos em cascata:

| Ordem | Modelo | Source tag |
|-------|--------|------------|
| 1º | `gemma3:4b` (leve) | `llm_small` |
| 2º | `mistral-nemo:12b` (robusto) | `llm_big` |
| Fallback | Frase aleatória da lista | `fallback` |

O prompt enviado ao LLM instrui o modelo a se comportar como "Lionel No IT", proibindo a invenção de dados institucionais e orientando o usuário a procurar a secretaria quando necessário.

**Requisito:** Ollama rodando localmente na porta `11434` com os modelos baixados.

---

## 5. Como Executar

### Pré-requisitos

- Python 3.10+
- Flask, requests, markdown (instalar via pip)
- Ollama instalado e rodando (para o fallback LLM)

### Instalação

```bash
pip install flask requests markdown
```

### Executar

```bash
cd Layonel_No_IT_CleanArchitecture
python app.py
```

Acesse em: `http://localhost:5000`

### Testes

```bash
python -m pytest tests/test_app.py -v
# ou
python tests/test_app.py
```

---

## 6. Formato das Respostas da API

**POST `/chat`**

Request:
```json
{ "mensagem": "o que tem na quarta?" }
```

Response (regras):
```json
{
  "source": "regras",
  "resposta": "Tem uma aula do balacobaco de INTRODUÇÃO À ENGENHARIA DE SOLUÇÕES com o professor HENRIQUE LIMA. Começa às 19:00 e termina às 22:40. Local é BLOCO H, SALA 110 📚"
}
```

Response (LLM):
```json
{
  "source": "llm_small",
  "resposta": "<p>Resposta gerada pelo modelo...</p>"
}
```

Response (erro):
```json
{
  "erro": "Informe uma mensagem válida."
}
```

---

## 7. Limitações do MVP

- A agenda é **estática** — codificada diretamente no `baseado_regras.py`. Qualquer mudança de horário exige edição manual do código.
- Os contadores de ironia são **em memória** — reiniciam a cada restart do servidor.
- O fallback LLM depende do **Ollama local** — sem ele, o bot só funciona para perguntas cobertas pelas regras.
- O campo `professores.json` e `secretaria.json` estão vazios/mínimos no MVP.
- A função `chat()` em `ia_service.py` chama `request.get_json()` internamente, **duplicando** o parse que já acontece em `app.py` — isso é um ponto de refatoração.

---

## 8. Melhorias Sugeridas

- Externalizar a agenda para um arquivo JSON ou banco de dados, eliminando edições de código para atualizações.
- Persistir os contadores em Redis ou banco para manter o estado entre restarts.
- Adicionar autenticação simples na rota `/chat` para evitar uso indevido.
- Separar a lógica de `request.get_json()` do `ia_service`, mantendo o service agnóstico ao framework HTTP.
- Ampliar os testes para cobrir os casos de cursos por campus e fallback LLM (com mock).
- Criar um `requirements.txt` para facilitar o setup.

---
