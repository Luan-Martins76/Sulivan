/**
 * Mini Chat Widget — home.html
 * IDs: #mini-response (output), #chat_bot (input), .btn-submit (botão)
 */

const Utils = {
    now: () => new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    escapeHtml: (str) => String(str).replace(/[&<>"']/g, match => {
        const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
        return map[match];
    })
};

const miniChat = {
    isAwaitingResponse: false,

    get response() { return document.getElementById('mini-response'); },
    get input()    { return document.getElementById('chat_bot'); },
    get btnSend()  { return document.querySelector('.btn-submit'); },

    addMsg(text, who) {
        const div = document.createElement('div');
        div.className = `mini-msg ${who}`;
        if (who === 'user') {
            div.textContent = text;
        } else {
            div.innerHTML = text;
        }
        this.response.appendChild(div);
        this.response.classList.add('has-content');
        this.response.scrollTop = this.response.scrollHeight;
    },

    showTyping() {
        const div = document.createElement('div');
        div.className = 'mini-msg bot typing-indicator';
        div.id = 'miniTyping';
        div.innerHTML = '<span></span><span></span><span></span>';
        this.response.appendChild(div);
        this.response.scrollTop = this.response.scrollHeight;
    },

    removeTyping() {
        const el = document.getElementById('miniTyping');
        if (el) el.remove();
    },

    setLoading(state) {
        this.isAwaitingResponse = state;
        if (this.btnSend) this.btnSend.disabled = state;
        if (this.input)   this.input.disabled = state;
    },

    async send() {
        if (this.isAwaitingResponse) return;

        const text = this.input.value.trim();
        if (!text) return;

        this.addMsg(text, 'user');
        this.input.value = '';
        this.setLoading(true);
        this.showTyping();

        let botText = '⚠️ Não consegui entender a resposta do servidor.';

        try {
            const res = await fetch('/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mensagem: text })
            });

            if (!res.ok) throw new Error(`HTTP ${res.status}`);

            const data = await res.json();
            botText = (data.response?.trim()) ? data.response :
                      (data.erro?.trim())     ? `⚠ ${data.erro}` : botText;

        } catch (err) {
            console.error("Erro na comunicação:", err);
            botText = '⚠️ Servidor indisponível. Verifique sua conexão.';
        }

        this.removeTyping();
        this.addMsg(botText, 'bot');
        this.setLoading(false);
    },

    init() {
        const input = this.input;
        const btn   = this.btnSend;

        if (input) {
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.send();
                }
            });
        }

        if (btn) {
            btn.addEventListener('click', () => this.send());
        }
    }
};

window.addEventListener('DOMContentLoaded', () => miniChat.init());
