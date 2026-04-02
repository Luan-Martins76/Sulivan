"""
Conversão do chat HTML → Kivy (Python)
Estrutura:
  - NavigationDrawer (sidebar principal)
  - ScreenManager (Home / Chat)
  - ChatScreen → histórico (sidebar) + mensagens + input
"""
from datetime import datetime

from kivy.app import App
from kivy.clock import Clock
from kivy.lang import Builder
from kivy.metrics import dp
from kivy.network.urlrequest import UrlRequest   # substitui o fetch() do JS
from kivy.properties import StringProperty, ListProperty, BooleanProperty
from kivy.uix.boxlayout import BoxLayout
from kivy.uix.label import Label
from kivy.uix.screenmanager import ScreenManager, Screen
from kivy.uix.scrollview import ScrollView
from services.ia_service import chat
# ─────────────────────────────────────────────────────────────
# Carrega o arquivo .kv
# ─────────────────────────────────────────────────────────────
Builder.load_file('templates/sulivan.kv')


# ════════════════════════════════════════════════════════════
# Helpers
# ════════════════════════════════════════════════════════════
def now():
    """Horário atual no formato HH:MM  →  equivalente ao now() do JS."""
    return datetime.now().strftime('%H:%M')


# ════════════════════════════════════════════════════════════
# Widget de bolha de mensagem
# (equivale ao .message-row do HTML)
# ════════════════════════════════════════════════════════════
class MessageRow(BoxLayout):
    """
    HTML equivalente:
        <div class="message-row [user]">
            <div class="msg-avatar">…</div>
            <div class="message [user|bot]-message">…</div>
        </div>
    """
    who   = StringProperty('bot')   # 'user' | 'bot'
    text  = StringProperty('')
    time  = StringProperty('')
    icon  = StringProperty('🤖')


# ════════════════════════════════════════════════════════════
# Item de histórico
# (equivale ao .history-item do HTML)
# ════════════════════════════════════════════════════════════
class HistoryItem(BoxLayout):
    title    = StringProperty('')
    subtitle = StringProperty('')
    active   = BooleanProperty(False)

    def on_touch_down(self, touch):
        if self.collide_point(*touch.pos):
            # Avisa a tela de chat que esse item foi clicado
            app = App.get_running_app()
            app.root.get_screen('chat').open_session_by_title(self.title)
            return True
        return super().on_touch_down(touch)


# ════════════════════════════════════════════════════════════
# Tela principal de Chat
# (equivale ao #view-chat do HTML)
# ════════════════════════════════════════════════════════════
class ChatScreen(Screen):
    sidebar_open = BooleanProperty(True)   # controla a sidebar de histórico

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.sessions        = []   # lista de sessões salvas
        self.current_session = None # sessão ativa
        Clock.schedule_once(self._init_chat, 0)

    def _init_chat(self, dt):
        """Inicia o primeiro chat ao abrir a tela."""
        self.new_chat()

    # ── Sessões ──────────────────────────────────────────────
    def new_chat(self):
        """
        JS equivalente: newChat()
        Cria nova sessão e limpa o chatbox.
        """
        self.current_session = {
            'id'      : f'sess-{datetime.now().timestamp()}',
            'title'   : 'Nova conversa',
            'date'    : datetime.now().strftime('%d/%m/%Y'),
            'messages': [],
        }
        self._clear_chatbox()
        self._add_bot_greeting()
        self._render_sidebar()

    def open_session_by_title(self, title):
        """Carrega sessão existente pelo título."""
        session = next((s for s in self.sessions if s['title'] == title), None)
        if not session:
            return
        self.current_session = session
        self._clear_chatbox()
        for m in session['messages']:
            self._render_message(m['who'], m['text'], m['time'])
        self._scroll_to_bottom()
        self._render_sidebar()

    def _save_session(self):
        """Salva / atualiza sessão na lista (equivale ao saveCurrentSession do JS)."""
        existing = next(
            (s for s in self.sessions
             if s['id'] == self.current_session['id']), None
        )
        if existing:
            existing.update(self.current_session)
        else:
            self.sessions.insert(0, dict(self.current_session))
        self._render_sidebar()

    # ── Sidebar de histórico ─────────────────────────────────
    def toggle_sidebar(self):
        """
        JS equivalente: toggleSidebar()
        Mostra/oculta o painel de histórico.
        """
        self.sidebar_open = not self.sidebar_open
        sidebar = self.ids.chat_sidebar
        sidebar.width    = dp(240) if self.sidebar_open else 0
        sidebar.opacity  = 1       if self.sidebar_open else 0

    def _render_sidebar(self):
        """Recria a lista de histórico (equivale ao renderSidebar() do JS)."""
        container = self.ids.history_list
        container.clear_widgets()
        container.height = 0

        if not self.sessions:
            lbl = Label(
                text       = 'Nenhuma conversa ainda.\nManda uma mensagem! 👀',
                color      = (0.6, 0.6, 0.6, 1),
                font_size  = '14sp',
                size_hint_y= None,
                height     = dp(60),
                halign     = 'center',
            )
            lbl.bind(size=lbl.setter('text_size'))
            container.add_widget(lbl)
            container.height += dp(60)
            return

        for s in self.sessions:
            item = HistoryItem(
                title    = s['title'],
                subtitle = f"{len(s['messages'])} mensagem(s)",
                active   = (s['id'] == self.current_session['id']),
            )
            container.add_widget(item)
            container.height += dp(60)

    def send_message(self):
        texto = self.ids.user_input.text  # ou de onde vem sua mensagem

        # salva mensagem do usuário
        self._render_message('user', texto, now())

        self._show_typing()

        def processar(dt):
            resposta = chat(texto)

            self._hide_typing()

            t = now()
            self._render_message('bot', str(resposta), t)

            self.current_session['messages'].append(
                {'who': 'bot', 'text': str(resposta), 'time': t}
            )

            self._save_session()

        from kivy.clock import Clock
        Clock.schedule_once(processar, 1.0)


   

    def _on_error(self, req, error):
        """Callback de erro (equivale ao catch do try/fetch)."""
        self._hide_typing()
        self._render_message('bot', '⚠️ Servidor offline. Certifique-se que o app.py está rodando.', now())

    # ── Helpers de UI ────────────────────────────────────────
    def _clear_chatbox(self):
        self.ids.chatbox.clear_widgets()
        self.ids.chatbox.height = 0

    def _add_bot_greeting(self):
        self._render_message('bot', 'Olá! Como posso ajudar hoje? 👀', now())

    def _render_message(self, who, text, time):
        """Cria e adiciona um MessageRow no chatbox."""
        row = MessageRow(
            who  = who,
            text = text,
            time = time,
            icon = '🧑' if who == 'user' else '🤖',
        )
        self.ids.chatbox.add_widget(row)
        self.ids.chatbox.height += dp(80)   # altura estimada por bolha
        self._scroll_to_bottom()

    def _scroll_to_bottom(self):
        """Rola o chat para o final (equivale ao scrollTop = scrollHeight)."""
        Clock.schedule_once(
            lambda dt: setattr(self.ids.chat_scroll, 'scroll_y', 0), 0.1
        )

    def _show_typing(self):
        """Indicador de digitação simples."""
        typing = Label(
            text      = '🤖  digitando…',
            color     = (0.6, 0.6, 0.6, 1),
            font_size = '14sp',
            size_hint_y = None,
            height    = dp(32),
        )
        typing.kivy_id = 'typing'
        self.ids.chatbox.add_widget(typing)
        self.ids.chatbox.height += dp(32)
        self._scroll_to_bottom()

    def _hide_typing(self):
        chatbox = self.ids.chatbox
        for w in chatbox.children[:]:
            if getattr(w, 'kivy_id', None) == 'typing':
                chatbox.remove_widget(w)
                chatbox.height -= dp(32)
                break


# ════════════════════════════════════════════════════════════
# Tela Home
# ════════════════════════════════════════════════════════════
class HomeScreen(Screen):
    pass


# ════════════════════════════════════════════════════════════
# Sidebar principal de navegação
# (equivale ao .sidebar do HTML)
# ════════════════════════════════════════════════════════════
class NavSidebar(BoxLayout):
    pass


# ════════════════════════════════════════════════════════════
# Root layout (container principal)
# ════════════════════════════════════════════════════════════
class RootLayout(BoxLayout):
    pass


# ════════════════════════════════════════════════════════════
# App
# ════════════════════════════════════════════════════════════
class SulivanApp(App):
    def build(self):
        return RootLayout()


if __name__ == '__main__':
    SulivanApp().run()
