// ─── estado ───────────────────────────────────────────────
let _resumoAtual = null;

// ─── referências ──────────────────────────────────────────
const infoBar    = document.querySelector('.info');
const infoIcon   = document.querySelector('.info__icon');
const infoClose  = document.querySelector('.info__close');

// ─── card do resumo (criado dinamicamente) ────────────────
const resumoCard = document.createElement('div');
resumoCard.id = 'resumo-card';
resumoCard.style.cssText = `
  display: none;
  position: absolute;
  background: #fff;
  border: 1px solid #509AF8;
  border-radius: 8px;
  padding: 14px 16px;
  max-width: 320px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  font-size: 13px;
  line-height: 1.5;
  color: #333;
  z-index: 999;
`;
// posiciona logo abaixo da barra — ajuste o parentElement se precisar
infoBar.style.position = 'relative';
infoBar.appendChild(resumoCard);

// ─── funções ──────────────────────────────────────────────
function mostrarCard() {
  if (!_resumoAtual) return;
  resumoCard.textContent = _resumoAtual;
  resumoCard.style.display = 'block';
  // posiciona abaixo da barra
  resumoCard.style.top = (infoBar.offsetHeight + 6) + 'px';
  resumoCard.style.left = '0';
}

function esconderCard() {
  resumoCard.style.display = 'none';
}

function esconderBarra() {
  esconderCard();
  infoBar.style.display = 'none';
}

// ─── eventos ──────────────────────────────────────────────
infoIcon.style.cursor = 'pointer';
infoIcon.addEventListener('click', () => {
  clearTimeout(infoBar._hideTimer); // ← isso aqui, cancela o timer de 8s
  resumoCard.style.display === 'block' ? esconderCard() : mostrarCard();
});

infoClose.addEventListener('click', esconderBarra);

// fecha o card ao clicar fora
document.addEventListener('click', (e) => {
  if (!infoBar.contains(e.target)) esconderCard();
});

// ─── chamado após receber resposta da rota /chat ──────────
function atualizarMemoria(data) {
  if (!data.memoria_atualizada || !data.resumo_memoria) return;

  _resumoAtual = data.resumo_memoria;
  infoBar.style.display = 'flex'; // mostra a barra
  esconderCard();                 // garante que o card começa fechado

  // some sozinho em 8s se o usuário não interagiu
  clearTimeout(infoBar._hideTimer);
  infoBar._hideTimer = setTimeout(esconderBarra, 8000);
}


/**
 * Utilitários — copiados do app.js para manter mini_chat_home.js independente
 */
const Utils = {
    now: () => new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    formatDate: () => new Date().toLocaleDateString('pt-BR'),
    escapeHtml: (str) => String(str).replace(/[&<>"']/g, match => {
        const escapeMap = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
        return escapeMap[match];
    }),
    generateId: () => `sess-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
};

/**
 * Lógica do Chat — extraída do app.js
 */
const chat = {
    sessions: [],
    activeSessionId: null,
    currentMessages: [],
    isAwaitingResponse: false,

    // Getter para sempre pegar elementos frescos do DOM
    get elements() {
        return {
            list:    document.getElementById('historyList'),
            chatbox: document.getElementById('chatbox'),
            title:   document.getElementById('chatTitle'),
            input:   document.getElementById('userInput'),
            btnSend: document.getElementById('sendBtn'),
            sidebar: document.getElementById('chatSidebar')
        };
    },

    async loadHistory() {
        try {
            const res = await fetch('/historico');
            if (!res.ok) throw new Error();
            const data = await res.json();

            this.sessions = data.mensagens.length > 0 ? [{
                id: 'sessao-atual',
                title: 'Conversa atual',
                date: Utils.formatDate(),
                messages: data.mensagens.map(m => ({
                    who: m.remetente === 'user' ? 'user' : 'bot',
                    text: m.conteudo,
                    time: Utils.now()
                }))
            }] : [];

        } catch (e) {
            console.error("Erro ao carregar histórico", e);
            this.sessions = [];
        }
        this.renderHistorySidebar();
    },

    async saveCurrentSession() {
        if (!this.activeSessionId || this.currentMessages.length === 0) return;

        const firstUserMsg = this.currentMessages.find(m => m.who === 'user');
        const generatedTitle = firstUserMsg
            ? (firstUserMsg.text.length > 25 ? firstUserMsg.text.substring(0, 25) + '...' : firstUserMsg.text)
            : 'Nova Conversa';

        const today = Utils.formatDate();
        const existingIndex = this.sessions.findIndex(s => s.id === this.activeSessionId);
        const sessionData = {
            id: this.activeSessionId,
            title: generatedTitle,
            date: today,
            messages: [...this.currentMessages]
        };

        if (existingIndex >= 0) {
            this.sessions[existingIndex] = sessionData;
        } else {
            this.sessions.unshift(sessionData);
        }

        this.renderHistorySidebar();
    },

    async clearHistory() {
        if (!confirm("Apagar todo o histórico?")) return;
        try {
            await fetch('/historico', { method: 'DELETE' });
            this.sessions = [];
            this.renderHistorySidebar();
            this.startNewSession();
        } catch (e) {
            console.error("Erro ao limpar histórico", e);
        }
    },

    renderHistorySidebar() {
        const list = this.elements.list;
        if (!list) return;

        if (this.sessions.length === 0) {
            list.innerHTML = `<div class="history-empty">Nenhuma conversa ainda.<br>Mande um "Olá"! 👋</div>`;
            return;
        }

        const groups = this.sessions.reduce((acc, session) => {
            const dateKey = session.date || 'Anteriormente';
            if (!acc[dateKey]) acc[dateKey] = [];
            acc[dateKey].push(session);
            return acc;
        }, {});

        let htmlString = '';
        for (const [date, items] of Object.entries(groups)) {
            htmlString += `<div class="history-section-label">${date}</div>`;
            items.forEach(s => {
                const isActive = s.id === this.activeSessionId ? 'active' : '';
                htmlString += `
                    <div class="history-item ${isActive}" onclick="chat.loadSession('${s.id}')" role="button" tabindex="0">
                        <div class="history-item-title" title="${Utils.escapeHtml(s.title)}">${Utils.escapeHtml(s.title)}</div>
                        <div class="history-item-meta">${s.messages.length} mensagem(ns)</div>
                    </div>
                `;
            });
        }
        list.innerHTML = htmlString;
    },

    toggleHistorySidebar() {
        const sidebar = this.elements.sidebar;
        if (sidebar) sidebar.classList.toggle('collapsed');
    },

    startNewSession() {
        this.activeSessionId = Utils.generateId();
        this.currentMessages = [];

        const { title, chatbox, input } = this.elements;
        if (title)   title.textContent = 'Nova conversa';
        if (chatbox) chatbox.innerHTML = `
            <div class="separator">Hoje</div>
            ${this.buildMessageHtml('bot', 'Olá! Como posso ajudar você hoje? 👀', null, Utils.now())}
        `;
        if (input) input.focus();

        this.renderHistorySidebar();
        this.scrollToBottom();
    },

    loadSession(id) {
        const session = this.sessions.find(s => s.id === id);
        if (!session) return;

        this.activeSessionId = id;
        this.currentMessages = [...session.messages];

        const { title, chatbox } = this.elements;
        if (title) title.textContent = session.title;

        let chatHtml = `<div class="separator">${session.date}</div>`;
        session.messages.forEach(m => {
            chatHtml += this.buildMessageHtml(m.who, m.text, m.source, m.time);
        });

        if (chatbox) chatbox.innerHTML = chatHtml;
        this.renderHistorySidebar();
        this.scrollToBottom();
    },

    buildMessageHtml(who, text, source, time) {
        const isUser = who === 'user';
        const rowClass = isUser ? 'message-row user' : 'message-row';
        const msgClass = isUser ? 'user-message' : 'bot-message';
        const icon = isUser ? '👤' : '🤖';
        const safeContent = isUser ? Utils.escapeHtml(text) : text;

        const badgeHtml = (source && source !== 'regras' && source !== 'fallback')
            ? `<span class="source-tag">${Utils.escapeHtml(source)}</span>`
            : '';

        return `
            <div class="${rowClass}">
                <div class="msg-avatar">${icon}</div>
                <div class="msg-content-wrapper">
                    <div class="message ${msgClass}">${safeContent}</div>
                    <div class="msg-meta">
                        ${badgeHtml}
                        <span class="msg-time">${time || Utils.now()}</span>
                    </div>
                </div>
            </div>
        `;
    },

    showTypingIndicator() {
        const { chatbox } = this.elements;
        if (!chatbox) return;
        chatbox.insertAdjacentHTML('beforeend', `
            <div class="message-row typing-row" id="typingIndicator">
                <div class="msg-avatar">🤖</div>
                <div class="typing-bubble"><span></span><span></span><span></span></div>
            </div>
        `);
        this.scrollToBottom();
    },

    removeTypingIndicator() {
        const el = document.getElementById('typingIndicator');
        if (el) el.remove();
    },

    scrollToBottom() {
        const { chatbox } = this.elements;
        if (chatbox) chatbox.scrollTo({ top: chatbox.scrollHeight, behavior: 'smooth' });
    },

    setLoadingState(isLoading) {
        this.isAwaitingResponse = isLoading;
        const { btnSend, input } = this.elements;
        if (btnSend) btnSend.disabled = isLoading;
        if (input)   input.disabled = isLoading;
        if (!isLoading && input) input.focus();
    },

    async handleSendMessage() {
        if (this.isAwaitingResponse) return;

        const { input, chatbox } = this.elements;
        const text = input?.value.trim();
        if (!text) return;

        if (!this.activeSessionId) this.startNewSession();

        const userTime = Utils.now();
        chatbox.insertAdjacentHTML('beforeend', this.buildMessageHtml('user', text, null, userTime));
        this.currentMessages.push({ who: 'user', text, time: userTime });

        input.value = '';
        this.setLoadingState(true);
        this.showTypingIndicator();

        let botText = '⚠️ Não consegui entender a resposta do servidor.';
        let botSource = null;

    try {
        const res = await fetch('/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mensagem: text })
        });

        if (!res.ok) throw new Error(`Status HTTP: ${res.status}`);

        const data = await res.json();
        botText = (data.response?.trim()) ? data.response :
                (data.erro?.trim())     ? `⚠ ${data.erro}` : botText;
        botSource = typeof data.source === 'string' ? data.source : null;

        atualizarMemoria(data); // ← aqui

    } catch (err) {
        console.error("Erro na comunicação:", err);
        botText = '⚠️ Servidor indisponível ou erro na requisição. Verifique sua conexão e se o backend está rodando.';
    }       
        this.removeTypingIndicator();
        const botTime = Utils.now();
        chatbox.insertAdjacentHTML('beforeend', this.buildMessageHtml('bot', botText, botSource, botTime));
        this.currentMessages.push({ who: 'bot', text: botText, source: botSource, time: botTime });

        this.setLoadingState(false);
        this.scrollToBottom();
        await this.saveCurrentSession();
    }
};

/**
 * Inicialização — sem depender do app.js
 */
window.addEventListener('DOMContentLoaded', () => {
    chat.loadHistory();

    const userInput = document.getElementById('userInput');
    if (userInput) {
        userInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                chat.handleSendMessage();
            }
        });
    }

    const chatbox = document.getElementById('chatbox');
    if (chatbox) {
        chatbox.addEventListener('click', () => {
            if (window.getSelection().toString().length === 0 && userInput) {
                userInput.focus();
            }
        });
    }
});