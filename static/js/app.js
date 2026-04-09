    /**
     * Utilitários Globais
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
     * Lógica Geral da Aplicação (Navegação)
     */
    const app = {
        init() {
            document.getElementById('init-time').textContent = Utils.now();
            chat.loadHistory();
            this.setupEventListeners();
        },

        setupEventListeners() {
            const userInput = document.getElementById('userInput');
            userInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    chat.handleSendMessage();
                }
            });
            
            // Foca no input quando clica na área do chat
            document.getElementById('chatbox').addEventListener('click', () => {
                const selection = window.getSelection();
                if (selection.toString().length === 0) {
                    userInput.focus();
                }
            });
        },

        switchView(viewName, linkEl) {
            // Oculta todas as views
            document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active'));
            // Remove active dos links
            document.querySelectorAll('.sidebar nav a').forEach(a => a.classList.remove('active'));
            
            // Ativa a selecionada
            const targetView = document.getElementById(`view-${viewName}`);
            if (targetView) targetView.classList.add('active');
            if (linkEl) linkEl.classList.add('active');

            // Widget flutuante só aparece no painel inicial
            const aiWidget = document.querySelector('.container-ai-input');
            if (aiWidget) aiWidget.style.display = viewName === 'home' ? '' : 'none';
            
            // Liga/desliga a animação do universo
            if (viewName === 'section-banner') {
                universe.start();
            } else {
                universe.stop();
            }

            // Lógica específica da view de chat
            if (viewName === 'chat' && !chat.activeSessionId) {
                chat.startNewSession();
            }
        }
    };

    /**
     * Lógica do Chat (Estado e Renderização)
     */
    const chat = {
        sessions: [],
        activeSessionId: null,
        currentMessages: [],
        isAwaitingResponse: false,

        // Elementos DOM cacheados
        elements: {
            list: document.getElementById('historyList'),
            chatbox: document.getElementById('chatbox'),
            title: document.getElementById('chatTitle'),
            input: document.getElementById('userInput'),
            btnSend: document.getElementById('sendBtn'),
            sidebar: document.getElementById('chatSidebar')
        },

        async loadHistory() {
            try {
                const res = await fetch('/historico');
                if (!res.ok) throw new Error();
                const data = await res.json();

                // Backend retorna { mensagens: [...] }
                // Transforma no formato que o frontend espera
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
            // ✅ Removido o TODO — backend já salva via /chat automaticamente

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
            if (this.sessions.length === 0) {
                this.elements.list.innerHTML = `<div class="history-empty">Nenhuma conversa ainda.<br>Mande um "Olá"! 👋</div>`;
                return;
            }

            // Agrupar por data
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
            this.elements.list.innerHTML = htmlString;
        },

        toggleHistorySidebar() {
            this.elements.sidebar.classList.toggle('collapsed');
        },

        startNewSession() {
            this.activeSessionId = Utils.generateId();
            this.currentMessages = [];
            
            this.elements.title.textContent = 'Nova conversa';
            this.elements.chatbox.innerHTML = `
                <div class="separator">Hoje</div>
                ${this.buildMessageHtml('bot', 'Olá! Como posso ajudar você hoje? 👀', null, Utils.now())}
            `;
            
            this.elements.input.focus();
            this.renderHistorySidebar();
            this.scrollToBottom();
        },

        loadSession(id) {
            const session = this.sessions.find(s => s.id === id);
            if (!session) return;

            this.activeSessionId = id;
            this.currentMessages = [...session.messages];
            this.elements.title.textContent = session.title;

            let chatHtml = `<div class="separator">${session.date}</div>`;
            session.messages.forEach(m => {
                chatHtml += this.buildMessageHtml(m.who, m.text, m.source, m.time);
            });

            this.elements.chatbox.innerHTML = chatHtml;
            this.renderHistorySidebar();
            this.scrollToBottom();
        },

        buildMessageHtml(who, text, source, time) {
            const isUser = who === 'user';
            const rowClass = isUser ? 'message-row user' : 'message-row';
            const msgClass = isUser ? 'user-message' : 'bot-message';
            const icon = isUser ? '👤' : '🤖';
            const safeContent = isUser ? Utils.escapeHtml(text) : text; // Bot envia HTML do Markdown

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
            const typingHtml = `
                <div class="message-row typing-row" id="typingIndicator">
                    <div class="msg-avatar">🤖</div>
                    <div class="typing-bubble"><span></span><span></span><span></span></div>
                </div>
            `;
            this.elements.chatbox.insertAdjacentHTML('beforeend', typingHtml);
            this.scrollToBottom();
        },

        removeTypingIndicator() {
            const el = document.getElementById('typingIndicator');
            if (el) el.remove();
        },

        scrollToBottom() {
            this.elements.chatbox.scrollTo({
                top: this.elements.chatbox.scrollHeight,
                behavior: 'smooth'
            });
        },

        setLoadingState(isLoading) {
            this.isAwaitingResponse = isLoading;
            this.elements.btnSend.disabled = isLoading;
            this.elements.input.disabled = isLoading;
            if (!isLoading) {
                this.elements.input.focus();
            }
        },

        async handleSendMessage() {
            if (this.isAwaitingResponse) return;

            const text = this.elements.input.value.trim();
            if (!text) return;

            if (!this.activeSessionId) this.startNewSession();

            // 1. Renderiza Mensagem do Usuário
            const userTime = Utils.now();
            this.elements.chatbox.insertAdjacentHTML('beforeend', this.buildMessageHtml('user', text, null, userTime));
            this.currentMessages.push({ who: 'user', text, time: userTime });
            
            this.elements.input.value = '';
            this.setLoadingState(true);
            this.showTypingIndicator();

            // 2. Chama API
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
                // fica assim — response já é o texto direto
                botText = (data.response?.trim()) ? data.response :
                        (data.erro?.trim()) ? `⚠ ${data.erro}` : botText;
                botSource = typeof data.source === 'string' ? data.source : null;

            } catch (err) {
                console.error("Erro na comunicação:", err);
                botText = '⚠️ Servidor indisponível ou erro na requisição. Verifique sua conexão e se o backend está rodando.';
            }

            // 3. Renderiza Resposta do Bot
            this.removeTypingIndicator();
            const botTime = Utils.now();
            this.elements.chatbox.insertAdjacentHTML('beforeend', this.buildMessageHtml('bot', botText, botSource, botTime));
            this.currentMessages.push({ who: 'bot', text: botText, source: botSource, time: botTime });
            
            this.setLoadingState(false);
            this.scrollToBottom();
            
            // 4. Salva Sessão
            await this.saveCurrentSession();
        }
    };

    // Inicializa a aplicação ao carregar a janela
    window.addEventListener('DOMContentLoaded', () => {
        app.init();

        // ── Mini Chat (widget flutuante) ──────────────────────────────
        const miniChat = {
            busy: false,

            get input()    { return document.getElementById('chat_bot'); },
            get response() { return document.getElementById('mini-response'); },

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
                div.className = 'mini-typing';
                div.id = 'mini-typing';
                div.innerHTML = '<span></span><span></span><span></span>';
                this.response.appendChild(div);
                this.response.classList.add('has-content');
                this.response.scrollTop = this.response.scrollHeight;
            },

            removeTyping() {
                const el = document.getElementById('mini-typing');
                if (el) el.remove();
            },

            async send() {
                if (this.busy) return;
                const text = this.input.value.trim();
                if (!text) return;

                this.busy = true;
                this.input.value = '';
                this.input.disabled = true;
                this.addMsg(text, 'user');
                this.showTyping();

                let botText = '⚠️ Servidor indisponível.';
                try {
                    const res = await fetch('/chat', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ mensagem: text })
                    });
                    if (!res.ok) throw new Error(`HTTP ${res.status}`);
                    const data = await res.json();
                    botText = (data.response?.resposta?.trim())
                        ? data.response.resposta
                        : (data.erro?.trim() ? `⚠️ ${data.erro}` : botText);
                } catch (err) {
                    console.error('Mini chat erro:', err);
                }

                this.removeTyping();
                this.addMsg(botText, 'bot');
                this.input.disabled = false;
                this.input.focus();
                this.busy = false;
            }
        };

        // Botão submit do mini chat
        document.querySelector('.btn-submit').addEventListener('click', () => miniChat.send());

        // Enter no textarea do mini chat (Shift+Enter = nova linha)
        document.getElementById('chat_bot').addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                miniChat.send();
            }
        });
    });

    // ─── UNIVERSO: animação controlada (só ativa no calendário) ───────────
    const universe = (() => {
        const canvas = document.getElementById('universe-canvas');
        const ctx = canvas.getContext('2d');

        let width, height, rafId = null, active = false;
        let stars = [], shootingStars = [];
        let mouseX = 0, mouseY = 0, targetMouseX = 0, targetMouseY = 0;
        let planetAngle = 0;

        const STAR_COUNT = 1200;
        const STAR_COLORS = ['#ffffff', '#e0f0ff', '#c0d8ff', '#ffe9c4', '#ffd5a0'];

        function resize() {
            const section = document.getElementById('view-section-banner');
            width  = canvas.width  = section.offsetWidth  || window.innerWidth;
            height = canvas.height = section.offsetHeight || window.innerHeight;
        }

        class Star {
            constructor() { this.reset(); }
            reset() {
                this.x = Math.random() * width;
                this.y = Math.random() * height;
                this.z = Math.random() * 2 + 1;
                this.radius = (Math.random() * 1.5) / this.z;
                this.color = STAR_COLORS[Math.floor(Math.random() * STAR_COLORS.length)];
                this.baseAlpha = Math.random() * 0.8 + 0.2;
                this.alpha = this.baseAlpha;
                this.twinkleSpeed = Math.random() * 0.03 + 0.005;
                this.twinkleOffset = Math.random() * Math.PI * 2;
            }
            update() {
                this.alpha = this.baseAlpha + Math.sin(Date.now() * this.twinkleSpeed + this.twinkleOffset) * 0.3;
                this.drawX = this.x - (mouseX / this.z);
                this.drawY = this.y - (mouseY / this.z);
            }
            draw() {
                ctx.globalAlpha = Math.max(0, Math.min(1, this.alpha));
                ctx.beginPath();
                ctx.arc(this.drawX, this.drawY, this.radius, 0, Math.PI * 2);
                ctx.fillStyle = this.color;
                ctx.fill();
                if (this.radius > 0.8 && this.alpha > 0.6 && isFinite(this.drawX) && isFinite(this.drawY)) {
                    const g = ctx.createRadialGradient(this.drawX, this.drawY, this.radius, this.drawX, this.drawY, this.radius * 4);
                    g.addColorStop(0, this.color);
                    g.addColorStop(1, 'rgba(0,0,0,0)');
                    ctx.beginPath();
                    ctx.arc(this.drawX, this.drawY, this.radius * 4, 0, Math.PI * 2);
                    ctx.fillStyle = g;
                    ctx.fill();
                }
            }
        }

        class ShootingStar {
            constructor() { this.active = false; }
            spawn() {
                this.active = true;
                this.x = Math.random() * width;
                this.y = Math.random() * (height / 2);
                this.length = Math.random() * 80 + 40;
                this.speed = Math.random() * 10 + 15;
                this.angle = Math.PI / 4 + (Math.random() * 0.2 - 0.1);
                this.opacity = 1;
            }
            update() {
                if (!this.active) return;
                this.x += Math.cos(this.angle) * this.speed;
                this.y += Math.sin(this.angle) * this.speed;
                this.opacity -= 0.015;
                if (this.opacity <= 0 || this.x > width || this.y > height) this.active = false;
            }
            draw() {
                if (!this.active) return;
                ctx.globalAlpha = this.opacity;
                ctx.beginPath();
                ctx.moveTo(this.x, this.y);
                ctx.lineTo(this.x - Math.cos(this.angle) * this.length, this.y - Math.sin(this.angle) * this.length);
                ctx.lineWidth = 1.5;
                const g = ctx.createLinearGradient(this.x, this.y, this.x - Math.cos(this.angle) * this.length, this.y - Math.sin(this.angle) * this.length);
                g.addColorStop(0, 'rgba(255,255,255,1)');
                g.addColorStop(1, 'rgba(255,255,255,0)');
                ctx.strokeStyle = g;
                ctx.stroke();
            }
        }

        function drawPlanet() {
            const cx = width * 0.72;
            const cy = height * 0.35;
            const r  = Math.min(width, height) * 0.12;

            ctx.save();
            ctx.globalAlpha = 1;

            // Sombra do planeta
            const shadow = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.1, cx, cy, r);
            shadow.addColorStop(0, '#5b8dd9');
            shadow.addColorStop(0.5, '#2a5298');
            shadow.addColorStop(1, '#050a1a');
            ctx.beginPath();
            ctx.arc(cx, cy, r, 0, Math.PI * 2);
            ctx.fillStyle = shadow;
            ctx.fill();

            // Faixas de atmosfera girando
            ctx.save();
            ctx.beginPath();
            ctx.arc(cx, cy, r, 0, Math.PI * 2);
            ctx.clip();
            const bandOffset = (planetAngle * 40) % (r * 2);
            const bands = [
                { y: -r * 0.6, h: r * 0.18, color: 'rgba(100,160,255,0.25)' },
                { y: -r * 0.2, h: r * 0.22, color: 'rgba(60,120,220,0.2)' },
                { y:  r * 0.15, h: r * 0.2,  color: 'rgba(80,140,240,0.22)' },
                { y:  r * 0.5,  h: r * 0.18, color: 'rgba(40,80,180,0.18)' },
            ];
            bands.forEach(b => {
                ctx.fillStyle = b.color;
                ctx.fillRect(cx - r, cy + b.y + (bandOffset % (b.h * 3)), r * 2, b.h);
            });
            ctx.restore();

            // Brilho polar
            const polar = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.4, 0, cx, cy, r);
            polar.addColorStop(0, 'rgba(200,230,255,0.35)');
            polar.addColorStop(0.4, 'rgba(120,170,255,0.08)');
            polar.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.beginPath();
            ctx.arc(cx, cy, r, 0, Math.PI * 2);
            ctx.fillStyle = polar;
            ctx.fill();

            // Anéis orbitais
            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(planetAngle * 0.3);
            ctx.scale(1, 0.28);

            const ringGrad = ctx.createRadialGradient(0, 0, r * 1.15, 0, 0, r * 1.9);
            ringGrad.addColorStop(0,   'rgba(150,190,255,0.0)');
            ringGrad.addColorStop(0.1, 'rgba(150,190,255,0.55)');
            ringGrad.addColorStop(0.5, 'rgba(180,210,255,0.35)');
            ringGrad.addColorStop(0.9, 'rgba(150,190,255,0.2)');
            ringGrad.addColorStop(1,   'rgba(150,190,255,0.0)');

            ctx.beginPath();
            ctx.arc(0, 0, r * 1.9, 0, Math.PI * 2);
            ctx.arc(0, 0, r * 1.15, 0, Math.PI * 2, true);
            ctx.fillStyle = ringGrad;
            ctx.fill();
            ctx.restore();

            ctx.restore();
        }

        function animate() {
            if (!active) return;
            ctx.clearRect(0, 0, width, height);

            mouseX += (targetMouseX - mouseX) * 0.05;
            mouseY += (targetMouseY - mouseY) * 0.05;

            stars.forEach(s => { try { s.update(); s.draw(); } catch(e) {} });
            shootingStars.forEach(s => {
                try {
                    if (!s.active && Math.random() < 0.005) s.spawn();
                    s.update(); s.draw();
                } catch(e) {}
            });

            planetAngle += 0.003;
            drawPlanet();

            ctx.globalAlpha = 1;
            rafId = requestAnimationFrame(animate);
        }

        function initParticles() {
            stars = [];
            shootingStars = [];
            for (let i = 0; i < STAR_COUNT; i++) stars.push(new Star());
            for (let i = 0; i < 3; i++) shootingStars.push(new ShootingStar());
        }

        window.addEventListener('mousemove', (e) => {
            targetMouseX = (e.clientX - width / 2) * 0.05;
            targetMouseY = (e.clientY - height / 2) * 0.05;
        });
        window.addEventListener('resize', () => { if (active) resize(); });

        return {
            start() {
                if (active) return;
                active = true;
                // requestAnimationFrame garante que o layout já foi computado
                // antes de medir as dimensões do canvas (offsetWidth/Height)
                requestAnimationFrame(() => {
                    resize();
                    initParticles();
                    animate();
                });
            },
            stop() {
                active = false;
                if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
            }
        };
    })();
