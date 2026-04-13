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
            
            // Lógica específica da view de chat
            if (viewName === 'chat' && !chat.activeSessionId) {
                chat.startNewSession();
            }
        }

    };

    /* Sincroniza ícone ativo com a view atual */
    const _origSwitch = app.switchView.bind(app);
    app.switchView = function(viewId, triggerEl) {
      document.querySelectorAll('.dock-list a').forEach(a => a.classList.remove('active-nav'));
      const active = document.querySelector(`.dock-list a[data-view="${viewId}"]`);
      if (active) active.classList.add('active-nav');
      _origSwitch(viewId, triggerEl);

      // Avisa o iframe do calendário quando ele fica visível
      // (necessário pois o iframe carrega com display:none e canvas fica sem dimensões)
      if (viewId === 'section-banner') {
        const calIframe = document.querySelector('#view-section-banner iframe');
        if (calIframe && calIframe.contentWindow) {
          calIframe.contentWindow.postMessage('calendario-activate', '*');
        }
      }
    };
    /* Marca "home" como ativo no carregamento */
    const homeLink = document.querySelector('.dock-list a[data-view="home"]');
    if (homeLink) homeLink.classList.add('active-nav');
