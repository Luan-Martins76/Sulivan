# 🤖 Sulivan — Chatbot Institucional UniEVANGÉLICA

**Projeto:** Sulivan (Lionel No IT)  
**Versão:** MVP (Clean Architecture v2)  
**Autores:** Luan Henrique (Martins) · Gabriel Silveira · Marcos · Maria Julia · Pedro Augusto · João Victor · Emily Alves  
**Data:** Março / 2026

---

## Visão Geral

O **Sulivan** é um assistente virtual desenvolvido para a **Universidade Evangélica de Goiás (UniEVANGÉLICA)**. Ele responde perguntas de alunos sobre horários de aula, cursos por campus, matérias/disciplinas e informações gerais da instituição — com uma personalidade bem-humorada e um vocabulário que dispensa formalidade.

O sistema combina um **motor baseado em regras** (respostas rápidas e determinísticas) com um **fallback via LLM local** (Ollama), garantindo uma resposta para qualquer pergunta — mesmo que seja uma resposta irônica.

O projeto conta com **duas interfaces**:
- **Web** — dashboard Flask com sidebar de navegação, chat com histórico, fundo animado de universo no calendário, e tela de login/cadastro com flip-card animado
- **Mobile** — aplicativo Kivy (`Kivy.py` + `sulivan.kv`), que reutiliza o mesmo serviço de IA do backend

---

## Estrutura do Projeto

```
Sulivan-main/
│
├── app.py                          # Servidor Flask — rotas HTTP
│
├── login/
│   └── logica_login.py             # Autenticação e cadastro de usuários (SQLite)
│
├── services/
│   ├── ia_service.py               # Lógica principal do chat (motor de regras + LLM)
│   └── baseado_regras.py           # Dados estáticos: agenda, aliases, fallbacks, contadores
│
├── dados/
│   ├── integração_dados.py         # Carregamento centralizado dos JSONs
│   ├── usuarios.db                 # Banco SQLite de usuários (gerado automaticamente)
│   ├── institucional.json          # Missão, visão, história da UniEVANGÉLICA
│   ├── cursos.json                 # Cursos por campus
│   ├── materias.json               # Disciplinas por curso
│   ├── professores.json            # Professores
│   ├── secretaria.json             # Dados da secretaria
│   └── calendario.json             # Calendário acadêmico
│
├── templates/
│   ├── index.html                  # Frontend web (Jinja2)
│   └── sulivan.kv                  # Layout declarativo do app Kivy
│
├── static/
│   ├── css/
│   │   ├── styles.css              # Estilos do dashboard web (~1400 linhas)
│   │   └── logincss.css            # Estilos do flip-card de login/cadastro
│   ├── js/
│   │   ├── app.js                  # Lógica de navegação, chat e animação (frontend)
│   │   └── login.js                # Funções fazerLogin() e fazerCadastro()
│   └── front_secundarios/
│       └── login.html              # Tela de login/cadastro (flip-card)
│
├── Kivy.py                         # App mobile (Kivy) — reutiliza ia_service diretamente
│
└── tests/
    ├── interface.html              # Interface de teste manual (standalone)
    └── test_app.py                 # Testes automatizados (unittest)
```

---

## Arquitetura

```
Usuário (browser ou app Kivy)
        │
        ▼
  login.html (flip-card)
        │
        ├── POST /login ────────▶ app.py (Flask)
        │                               │
        └── POST /cadastro ─────────────┤
                                        │
                                        ▼
                                 logica_login.py
                                        │
                          ┌─────────────┴─────────────┐
                          │                           │
                   validar_usuario()           criar_conta()
                          │                           │
                          └─────────────┬─────────────┘
                                        │
                                  dados/usuarios.db (SQLite)
                                        │
                              Sessão Flask iniciada
                                        │
                                        ▼
                               index.html / Kivy.py
                                        │
                              ┌─────────┴──────────┐
                              │                    │
                     Web: POST /chat        Mobile: chamada direta
                              │                    │
                              └─────────┬──────────┘
                                        │
                                 ia_service.chat()
                                        │
                        ┌──────────────┴──────────────┐
                        │                             │
                  Regra encontrada?             Nenhuma regra
                        │                             │
                 baseado_regras                Tenta LLM (Ollama)
                        │                      gemma3:4b → mistral-nemo:12b
                        │                             │
                        │                      Falha? → fallback()
                        └──────────────┬──────────────┘
                                       │
                                { source, resposta }
```

---

## Componentes

### `app.py` — Servidor Flask

Ponto de entrada da aplicação web. Expõe as seguintes rotas:

| Rota | Método | Descrição |
|------|--------|-----------|
| `/` | GET | Serve o dashboard (index.html) |
| `/login` | POST | Autentica usuário com email e senha |
| `/cadastro` | POST | Cria nova conta de usuário |
| `/logout` | POST | Encerra a sessão do usuário |
| `/health` | GET | Healthcheck — retorna `{"status": "ok"}` |
| `/chat` | POST | Recebe `{"mensagem": "..."}` e retorna a resposta do bot |

A `secret_key` do Flask é obrigatória para o funcionamento das sessões. Troque o valor padrão antes de colocar em produção.

---

### `login/logica_login.py` — Autenticação e Cadastro

Responsável por toda a lógica de usuários. Usa **SQLite** (`dados/usuarios.db`) como banco de dados, criado automaticamente na primeira execução.

**Estrutura da tabela `usuarios`:**

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | INTEGER | Chave primária, autoincremento |
| `nome` | TEXT | Nome do usuário |
| `email` | TEXT UNIQUE | Email (sempre em minúsculo) |
| `senha` | TEXT | Hash seguro da senha (werkzeug) |
| `criado_em` | DATETIME | Data/hora do cadastro (automático) |

**Funções disponíveis:**

- `validar_usuario(email, password)` — verifica credenciais. Retorna o usuário como `dict` se válido, ou `None` se inválido.
- `criar_conta(nome, email, password)` — cadastra um novo usuário. Retorna `(True, usuario)` em caso de sucesso ou `(False, mensagem_de_erro)` se o email já existir.

Senhas nunca são armazenadas em texto puro — apenas o hash gerado por `werkzeug.security.generate_password_hash`.

---

### `static/front_secundarios/login.html` — Tela de Login/Cadastro

Interface com **flip-card animado**: o lado da frente é o formulário de login e o verso é o formulário de cadastro. A alternância entre os dois é feita com um checkbox CSS.

- Frente: campos de email e senha → chama `fazerLogin()`
- Verso: campos de nome, email e senha → chama `fazerCadastro()`

---

### `static/js/login.js` — Lógica do Frontend de Autenticação

Duas funções assíncronas que fazem `fetch` para o backend:

- `fazerLogin()` — envia email e senha via `POST /login`. Em caso de sucesso, redireciona para `/`. Em caso de erro, exibe o alerta com a mensagem retornada pelo servidor.
- `fazerCadastro()` — envia nome, email e senha via `POST /cadastro`. Em caso de sucesso, exibe boas-vindas e redireciona para `/`. Em caso de erro (ex: email já cadastrado), exibe o alerta.

---

### `services/ia_service.py` — Motor de Chat

Contém toda a lógica de processamento de mensagens. A função `chat()` funciona tanto com request HTTP (Flask) quanto com chamada direta por parâmetro (Kivy).

**Ordem de prioridade no despacho:**

1. **Agenda** — detecta dia da semana e retorna horário, matéria, professor e local
2. **Criador** — palavra-chave `"criador"` retorna crédito ao autor
3. **Cursos** — detecta `"curso"` + nome de campus → lista cursos disponíveis
4. **Matérias** — detecta `"materia"` ou `"disciplina"` + nome do curso → lista disciplinas (online e presenciais)
5. **Nome** — pergunta sobre o nome do bot (com escalada irônica progressiva)
6. **Calculadora** — resposta humorística redirecionando o usuário
7. **Saída** — detecta `"tchau"`, `"sair"`, `"bye"`, `"falou"`
8. **LLM** — tenta `gemma3:4b`, depois `mistral-nemo:12b` via Ollama
9. **Fallback** — frase aleatória da lista de respostas irônicas

Funções auxiliares principais:

- `normalize_text(text)` — remove acentos para comparação robusta
- `resolve_day(mensagem)` — identifica dias da semana na mensagem (com ou sem acento)
- `formatar_cursos(dados, campus)` — formata lista de cursos de um campus
- `formatar_materia(dados, curso)` — formata disciplinas online e presenciais de um curso
- `call_llm(model, prompt)` — faz POST para a API local do Ollama (timeout 20s)

---

### `services/baseado_regras.py` — Dados Estáticos

Define a agenda semanal (segunda a sábado), o mapa de aliases de dias (`"terca"` → `"terça"`), os contadores de ironia por categoria e a lista de ~20 respostas de fallback.

Os contadores habilitam escalada progressiva de ironia: após N perguntas repetidas sobre o mesmo tópico, o bot começa a reclamar.

---

### `dados/` — Camada de Dados

Todos os JSONs são carregados no startup via `integração_dados.py`:

| Arquivo | Conteúdo |
|---------|----------|
| `usuarios.db` | Banco SQLite de usuários (gerado automaticamente) |
| `institucional.json` | Missão, visão, valores, história (1947–2021), reitoria |
| `cursos.json` | Cursos agrupados por campus (Anápolis, Ceres, Jaraguá, Rubiataba, Senador Canedo, ACDOC, Capelania) |
| `materias.json` | Disciplinas online e presenciais por curso |
| `professores.json` | Professores (em expansão) |
| `secretaria.json` | Dados da secretaria (em expansão) |
| `calendario.json` | Calendário acadêmico |

---

### Frontend Web (`templates/` + `static/`)

Dashboard single-page servido pelo Flask, com navegação por sidebar. Os assets foram refatorados do `index.html` monolítico para arquivos separados servidos via `url_for('static', ...)`.

**`static/js/app.js`** — organizado em módulos JavaScript:
- `Utils` — funções utilitárias (hora, data, escape HTML, geração de ID de sessão)
- `app` — navegação entre views, setup de event listeners
- `chat` — envio de mensagens, renderização de bolhas, histórico de conversas, toggle da sidebar
- `universe` — animação canvas do fundo do Calendário (estrelas, planetas, paralaxe com mouse)

**`static/css/styles.css`** — ~1400 linhas cobrindo layout do dashboard, tema dark, sidebar, chat, animações e responsividade.

**Views disponíveis:**
- **Início** — boas-vindas, widget flutuante de mini-chat (só aparece nessa view)
- **Calendário** — fundo animado de universo com canvas, planetas e paralaxe
- **Chat** — interface completa com histórico de sessões na sidebar, bolhas de mensagem e input

---

### `Kivy.py` + `templates/sulivan.kv` — App Mobile

Versão mobile do Sulivan em Kivy, com:
- `NavigationDrawer` — sidebar de navegação
- `ScreenManager` — alternância entre telas Home e Chat
- `MessageRow` — widget de bolha de mensagem (equivalente ao `.message-row` do HTML)
- `UrlRequest` — chamada assíncrona ao backend Flask (equivalente ao `fetch()` do JS)

O `Kivy.py` também suporta chamada direta ao `ia_service.chat()` sem passar pelo HTTP, útil para rodar sem o servidor Flask ativo.

---

### `tests/test_app.py` — Testes Automatizados

Três casos de teste com `unittest` e o test client do Flask:

| Teste | O que verifica |
|-------|----------------|
| `test_chat_rejects_empty_message` | Mensagens vazias retornam HTTP 400 com `{"erro": "..."}` |
| `test_chat_handles_day_without_accent` | `"terca"` (sem acento) é detectado corretamente e retorna a matéria certa |
| `test_healthcheck` | `/health` retorna 200 com `{"status": "ok"}` |

---

## API

**POST `/login`**

Request:
```json
{ "email": "aluno@uni.com", "password": "senha123" }
```

Response (sucesso):
```json
{ "status": "ok", "nome": "Luan Henrique" }
```

Response (erro):
```json
{ "erro": "Email ou senha inválidos" }
```

---

**POST `/cadastro`**

Request:
```json
{ "nome": "Luan Henrique", "email": "aluno@uni.com", "password": "senha123" }
```

Response (sucesso):
```json
{ "status": "ok", "nome": "Luan Henrique" }
```

Response (erro — email duplicado):
```json
{ "erro": "Email já cadastrado" }
```

---

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
{ "erro": "Informe uma mensagem válida." }
```

O campo `source` pode ser: `"regras"`, `"llm_small"`, `"llm_big"` ou `"fallback"`.

---

## Como Executar

### Pré-requisitos

- Python 3.10+
- Ollama instalado e rodando (necessário apenas para o fallback LLM)

### Instalação

```bash
pip install flask requests markdown werkzeug
```

Para o app mobile:
```bash
pip install kivy
```

### Rodar o servidor web

```bash
python app.py
```

Acesse em: `http://localhost:5000`

A tela de login fica em: `http://localhost:5000/static/front_secundarios/login.html`

O banco `dados/usuarios.db` é criado automaticamente no primeiro cadastro.

### Rodar o app Kivy

```bash
python Kivy.py
```

### Rodar os testes

```bash
python -m pytest tests/test_app.py -v
# ou
python tests/test_app.py
```

---

## LLM (Ollama)

Quando nenhuma regra cobre a pergunta, o sistema tenta dois modelos em cascata:

| Ordem | Modelo | Source tag |
|-------|--------|------------|
| 1º | `gemma3:4b` (leve) | `llm_small` |
| 2º | `mistral-nemo:12b` (robusto) | `llm_big` |
| Fallback | Frase aleatória | `fallback` |

O prompt instrui o modelo a se comportar como "Lionel No IT", proibindo invenção de dados institucionais e orientando o usuário a procurar a secretaria quando necessário.

**Requisito:** Ollama rodando localmente na porta `11434` com os modelos baixados.

---

## Limitações do MVP

- A agenda é **estática** — codificada no `baseado_regras.py`. Mudanças de horário exigem edição manual do código.
- Os contadores de ironia ficam **em memória** — reiniciam a cada restart do servidor.
- O fallback LLM exige o **Ollama local** rodando. Sem ele, só funcionam as regras pré-definidas.
- `professores.json` e `secretaria.json` estão mínimos no MVP.
- Não há `requirements.txt` ainda.
- O `login.html` é servido como arquivo estático — qualquer um acessa a URL sem estar logado. O ideal seria uma rota Flask `/login` servindo o template.
- `debug=True` ainda ativo no `app.py` — desligar antes de entregar/publicar.

---

## Melhorias Sugeridas

- Criar middleware de autenticação para proteger `/chat` e o dashboard, redirecionando para o login quando não há sessão ativa.
- Mover `login.html` para `templates/` e servi-lo via rota Flask (`GET /login`), impedindo acesso direto ao arquivo estático.
- Externalizar a agenda para um JSON ou banco de dados, eliminando edições de código para atualizações.
- Persistir contadores em Redis para manter estado entre restarts.
- Criar `requirements.txt` para facilitar o setup.
- Separar o parse de `request.get_json()` do `ia_service`, mantendo o service agnóstico ao framework HTTP.
- Ampliar os testes para cobrir login, cadastro, email duplicado e fallback LLM (com mock).
- Trocar a `secret_key` fixa por uma variável de ambiente (`os.environ.get("SECRET_KEY")`).
