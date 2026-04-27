/* ══════════════════════════════════════════
   XERA SOCIAL — app.js
   Toda a lógica da aplicação em vanilla JS
══════════════════════════════════════════ */

"use strict";

// ─── CONTADORES DE ID ─────────────────────
let _postId    = 4;
let _commentId = 10;
let _userId    = 4;

// ─── DADOS INICIAIS ───────────────────────
const SEED_USERS = [
  { id: 1, name: "Luna Silva",    email: "luna@xera.io",  password: "123", initials: "LS", hue: 251 },
  { id: 2, name: "Davi Costa",   email: "davi@xera.io",  password: "123", initials: "DC", hue: 213 },
  { id: 3, name: "Mari Andrade", email: "mari@xera.io",  password: "123", initials: "MA", hue: 158 },
];

const SEED_POSTS = [
  {
    id: 1, userId: 2,
    message: "Alguém mais acha que IA vai substituir devs ou é só hype? 🤔 Sinto que vai mudar muito o mercado mas não eliminar a profissão tão cedo.",
    likes_count: 14, comments_count: 2,
    comments: [
      { id: 1, userId: 1, message: "Vai mudar o papel, não eliminar. Quem souber usar IA vai dominar o jogo!", createdAt: new Date(Date.now() - 900000) },
      { id: 2, userId: 3, message: "Concordo. Prompt engineering já virou skill necessária haha",             createdAt: new Date(Date.now() - 300000) },
    ],
    createdAt: new Date(Date.now() - 7200000),
  },
  {
    id: 2, userId: 3,
    message: "Terminei minha primeira API REST completa hoje 🎉🚀\n\nFastAPI + SQLite + JWT auth. Próximo passo: deploy no Railway. Ainda não acredito que funcionou de primeira haha",
    likes_count: 28, comments_count: 1,
    comments: [
      { id: 3, userId: 2, message: "VAMOS!! Primeira API sempre é especial 🔥 Railway é ótimo pra isso btw", createdAt: new Date(Date.now() - 3600000) },
    ],
    createdAt: new Date(Date.now() - 18000000),
  },
  {
    id: 3, userId: 1,
    message: "Dica do dia: sempre commit com mensagem descritiva. O você do futuro agradece muito 🙏\n\n✅ fix: corrige bug de auth no endpoint de login\n❌ fix bug\n\nParece besteira mas faz diferença DEMAIS quando você volta no histórico.",
    likes_count: 42, comments_count: 0,
    comments: [],
    createdAt: new Date(Date.now() - 86400000),
  },
];

// ─── ESTADO GLOBAL ────────────────────────
const state = {
  currentUser : null,
  users       : [...SEED_USERS],
  posts       : [...SEED_POSTS],
  likedSet    : new Set(),       // IDs de posts curtidos pelo usuário atual
  openCmts    : new Set(),       // IDs de posts com comentários abertos
  view        : "feed",          // "feed" | "profile"
  profileId   : null,
  authMode    : "login",         // "login" | "register"
};

// ─── HELPERS ──────────────────────────────
function getUser(id) { return state.users.find(u => u.id === id); }

function timeAgo(date) {
  const d = Math.floor((Date.now() - new Date(date)) / 1000);
  if (d < 60)    return "agora";
  if (d < 3600)  return `${Math.floor(d / 60)}m`;
  if (d < 86400) return `${Math.floor(d / 3600)}h`;
  return `${Math.floor(d / 86400)}d`;
}

function hslColor(hue) { return `hsl(${hue}, 60%, 48%)`; }

/** Cria um elemento <div class="avatar"> com iniciais e cor do usuário */
function createAvatar(user, size = 38) {
  const el = document.createElement("div");
  el.className = "avatar";
  el.style.cssText = [
    `width:${size}px`, `height:${size}px`,
    `background:${hslColor(user.hue)}`,
    `font-size:${(size * 0.37).toFixed(1)}px`,
  ].join(";");
  el.textContent = user.initials;
  return el;
}

/** Preenche um .avatar-wrap com um avatar */
function mountAvatar(wrap, user, size) {
  wrap.innerHTML = "";
  if (user) wrap.appendChild(createAvatar(user, size));
}

// ══════════════════════════════════════════
// ESTRELAS DO FUNDO (tela de auth)
// ══════════════════════════════════════════
function buildStars() {
  const container = document.getElementById("stars-container");
  if (!container) return;
  container.innerHTML = "";
  for (let i = 0; i < 70; i++) {
    const star = document.createElement("div");
    star.className = "star";
    const left    = (i * 137.508) % 100;
    const top     = (i * 97.3) % 100;
    const size    = i % 7 === 0 ? 2.5 : i % 3 === 0 ? 2 : 1.5;
    const opacity = (0.2 + ((i * 53) % 10) / 15).toFixed(2);
    const dur     = 8 + (i % 10);
    star.style.cssText = [
      `left:${left}%`, `top:${top}%`,
      `width:${size}px`, `height:${size}px`,
      `opacity:${opacity}`,
      `--dur:${dur}s`,
      `animation-delay:${i % 6}s`,
    ].join(";");
    container.appendChild(star);
  }
}

// ══════════════════════════════════════════
// TELA DE AUTH
// ══════════════════════════════════════════
function renderAuth() {
  // Mostra/oculta telas
  document.getElementById("auth-screen").style.display = "flex";
  document.getElementById("app-screen").style.display  = "none";

  buildStars();
  renderDemoAccounts();
  applyAuthMode();

  // Limpar erros ao trocar modo
  document.getElementById("auth-toggle-link").addEventListener("click", () => {
    state.authMode = state.authMode === "login" ? "register" : "login";
    setAuthError("");
    applyAuthMode();
  });

  document.getElementById("auth-btn").addEventListener("click", handleAuth);

  // Enter nos campos
  ["auth-email", "auth-password"].forEach(id => {
    document.getElementById(id).addEventListener("keydown", e => {
      if (e.key === "Enter") handleAuth();
    });
  });
}

function applyAuthMode() {
  const isLogin = state.authMode === "login";
  document.getElementById("auth-subtitle").textContent   = isLogin ? "entre na sua conta" : "crie sua conta";
  document.getElementById("auth-name").style.display     = isLogin ? "none" : "block";
  document.getElementById("auth-btn").textContent        = isLogin ? "Entrar" : "Criar conta";
  document.getElementById("auth-toggle-text").textContent = isLogin ? "Não tem conta? " : "Já tem conta? ";
  document.getElementById("auth-toggle-link").textContent = isLogin ? "Cadastre-se" : "Entrar";
}

function renderDemoAccounts() {
  const container = document.getElementById("demo-accounts");
  container.innerHTML = "";
  SEED_USERS.forEach(u => {
    const row = document.createElement("div");
    row.className = "demo-row";

    const av = createAvatar(u, 24);
    const em = document.createElement("span");
    em.className = "demo-email";
    em.textContent = u.email;
    const pw = document.createElement("span");
    pw.className = "demo-pass";
    pw.textContent = "senha: 123";

    row.appendChild(av);
    row.appendChild(em);
    row.appendChild(pw);

    row.addEventListener("click", () => {
      document.getElementById("auth-email").value    = u.email;
      document.getElementById("auth-password").value = "123";
      state.authMode = "login";
      setAuthError("");
      applyAuthMode();
    });

    container.appendChild(row);
  });
}

function setAuthError(msg) {
  document.getElementById("auth-error").textContent = msg;
}

function handleAuth() {
  if (state.authMode === "login") handleLogin();
  else handleRegister();
}

function handleLogin() {
  const email    = document.getElementById("auth-email").value.trim();
  const password = document.getElementById("auth-password").value;
  const u = state.users.find(u => u.email === email && u.password === password);
  if (!u) { setAuthError("Email ou senha incorretos"); return; }
  state.currentUser = u;
  state.likedSet    = new Set();
  state.openCmts    = new Set();
  setAuthError("");
  renderApp();
}

function handleRegister() {
  const name     = document.getElementById("auth-name").value.trim();
  const email    = document.getElementById("auth-email").value.trim();
  const password = document.getElementById("auth-password").value;

  if (!name || !email || !password) { setAuthError("Preencha todos os campos"); return; }
  if (state.users.find(u => u.email === email)) { setAuthError("Email já cadastrado"); return; }

  const initials = name.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase();
  const hues     = [30, 50, 90, 135, 175, 200, 280, 320, 350];
  const nu       = { id: _userId++, name, email, password, initials, hue: hues[_userId % hues.length] };

  state.users.push(nu);
  state.currentUser = nu;
  setAuthError("");
  renderApp();
}

// ══════════════════════════════════════════
// APP PRINCIPAL
// ══════════════════════════════════════════
function renderApp() {
  document.getElementById("auth-screen").style.display = "none";
  document.getElementById("app-screen").style.display  = "flex";

  renderSidebar();
  renderFeedColumn();
  renderRightPanel();
}

// ─── SIDEBAR ──────────────────────────────
function renderSidebar() {
  const cu = state.currentUser;

  // Contagem de usuários
  document.getElementById("user-count").textContent = state.users.length;

  // Footer do usuário logado
  const footerAv = document.getElementById("footer-avatar");
  mountAvatar(footerAv, cu, 32);
  document.getElementById("footer-name").textContent = cu.name;

  // Logout
  const logoutBtn = document.getElementById("logout-btn");
  logoutBtn.replaceWith(logoutBtn.cloneNode(true)); // remove listeners antigos
  document.getElementById("logout-btn").addEventListener("click", handleLogout);

  // Nav feed
  const navFeed = document.getElementById("nav-feed");
  navFeed.replaceWith(navFeed.cloneNode(true));
  document.getElementById("nav-feed").addEventListener("click", () => gotoFeed());

  // Lista de usuários
  renderUserList();
}

function renderUserList() {
  const list = document.getElementById("user-list");
  list.innerHTML = "";

  state.users.forEach(u => {
    const item = document.createElement("div");
    item.className = "user-item" + (state.view === "profile" && state.profileId === u.id ? " active-profile" : "");

    const av = createAvatar(u, 28);
    const info = document.createElement("div");
    info.style.minWidth = "0";

    const nameEl = document.createElement("div");
    nameEl.className = "user-item-name" + (u.id === state.currentUser.id ? " is-me" : "");
    nameEl.textContent = u.name;

    const postsEl = document.createElement("div");
    postsEl.className = "user-item-posts";
    postsEl.textContent = `${state.posts.filter(p => p.userId === u.id).length} posts`;

    info.appendChild(nameEl);
    info.appendChild(postsEl);
    item.appendChild(av);
    item.appendChild(info);

    item.addEventListener("click", () => gotoProfile(u.id));
    list.appendChild(item);
  });
}

// ─── FEED COLUMN ──────────────────────────
function renderFeedColumn() {
  const isProfile = state.view === "profile" && state.profileId;
  const profileUser = isProfile ? getUser(state.profileId) : null;
  const cu = state.currentUser;

  // Profile header
  const ph = document.getElementById("profile-header");
  ph.style.display = isProfile ? "block" : "none";
  if (isProfile && profileUser) {
    document.getElementById("back-btn").onclick = gotoFeed;
    const profAv = document.getElementById("profile-avatar");
    mountAvatar(profAv, profileUser, 56);
    document.getElementById("profile-name").textContent = profileUser.name;
    const postCount = state.posts.filter(p => p.userId === profileUser.id).length;
    document.getElementById("profile-meta").innerHTML =
      `${postCount} publicações` +
      (profileUser.id === cu.id
        ? `<span style="margin-left:8px;color:var(--accent);font-size:11px;background:rgba(59,130,246,0.14);padding:2px 8px;border-radius:20px">você</span>`
        : "");
  }

  // Feed title
  document.getElementById("feed-title").style.display = isProfile ? "none" : "flex";
  document.getElementById("post-count").textContent   = `${state.posts.length} posts`;

  // Compositor
  const composer = document.getElementById("composer");
  composer.style.display = isProfile ? "none" : "block";
  mountAvatar(document.getElementById("composer-avatar"), cu, 38);

  const textarea  = document.getElementById("new-post-input");
  const pubBtn    = document.getElementById("publish-btn");

  // Remove listeners antigos com clone
  const newTextarea = textarea.cloneNode(true);
  textarea.replaceWith(newTextarea);
  const newPubBtn = pubBtn.cloneNode(true);
  pubBtn.replaceWith(newPubBtn);

  newTextarea.addEventListener("input", () => {
    newPubBtn.disabled = !newTextarea.value.trim();
  });
  newTextarea.addEventListener("keydown", e => {
    if (e.key === "Enter" && e.ctrlKey) handlePost();
  });
  newPubBtn.addEventListener("click", handlePost);

  // Posts visíveis
  const visiblePosts = isProfile
    ? state.posts.filter(p => p.userId === state.profileId)
    : state.posts;

  // Empty state
  const emptyEl = document.getElementById("empty-state");
  emptyEl.style.display = visiblePosts.length === 0 ? "block" : "none";
  emptyEl.textContent   = state.view === "profile"
    ? "Este usuário ainda não publicou nada."
    : "Nenhum post ainda. Seja o primeiro! ☝️";

  // Renderiza posts
  renderPosts(visiblePosts);
}

function renderPosts(visiblePosts) {
  const list = document.getElementById("posts-list");
  list.innerHTML = "";

  const tpl = document.getElementById("post-tpl");

  visiblePosts.forEach((post, i) => {
    const author = getUser(post.userId);
    const isLiked = state.likedSet.has(post.id);
    const showCmts = state.openCmts.has(post.id);

    // Clona template
    const node = tpl.content.cloneNode(true);
    const postEl = node.querySelector(".post");
    postEl.style.animation = `slideUp 0.3s ${i * 0.04}s both`;

    // Avatar do autor (clicável)
    const postAv = postEl.querySelector(".post-avatar");
    postAv.appendChild(createAvatar(author, 38));
    postAv.addEventListener("click", () => gotoProfile(post.userId));

    // Autor
    const authorEl = postEl.querySelector(".post-author");
    authorEl.textContent = author?.name ?? "?";
    authorEl.addEventListener("click", () => gotoProfile(post.userId));

    // Badge "você"
    const youBadge = postEl.querySelector(".post-you-badge");
    youBadge.style.display = (post.userId === state.currentUser.id) ? "inline" : "none";

    // Tempo
    postEl.querySelector(".post-time").textContent = timeAgo(post.createdAt);

    // Mensagem
    postEl.querySelector(".post-message").textContent = post.message;

    // Like
    const likeBtn = postEl.querySelector(".like-btn");
    likeBtn.querySelector(".like-icon").textContent = isLiked ? "♥" : "♡";
    likeBtn.querySelector(".like-count").textContent = post.likes_count;
    if (isLiked) likeBtn.classList.add("liked");
    likeBtn.addEventListener("click", () => { handleLike(post.id); });

    // Comentários toggle
    const cmtBtn = postEl.querySelector(".cmt-btn");
    cmtBtn.querySelector(".cmt-count").textContent = post.comments_count;
    if (showCmts) cmtBtn.classList.add("open");
    cmtBtn.addEventListener("click", () => { toggleCmts(post.id); });

    // Seção de comentários
    const cmtSection = postEl.querySelector(".comments-section");
    cmtSection.style.display = showCmts ? "block" : "none";
    if (showCmts) renderComments(post, cmtSection);

    list.appendChild(postEl);
  });
}

function renderComments(post, section) {
  const cmtList = section.querySelector(".comments-list");
  cmtList.innerHTML = "";

  post.comments.forEach(c => {
    const ca   = getUser(c.userId);
    const row  = document.createElement("div");
    row.className = "comment-row";

    const av = createAvatar(ca, 28);

    const bubble = document.createElement("div");
    bubble.className = "comment-bubble";
    bubble.innerHTML = `
      <div class="comment-author">${ca?.name ?? "?"}</div>
      <div class="comment-text">${escapeHtml(c.message)}</div>
      <div class="comment-time">${timeAgo(c.createdAt)}</div>
    `;
    row.appendChild(av);
    row.appendChild(bubble);
    cmtList.appendChild(row);
  });

  // Avatar do usuário atual no input de comentário
  const cmtAv = section.querySelector(".cmt-avatar");
  mountAvatar(cmtAv, state.currentUser, 28);

  // Input de comentário
  const cmtInput = section.querySelector(".cmt-input");
  const sendBtn  = section.querySelector(".btn-send");

  const submit = () => {
    const text = cmtInput.value.trim();
    if (!text) return;
    handleComment(post.id, text);
    cmtInput.value = "";
  };

  cmtInput.addEventListener("keydown", e => { if (e.key === "Enter") submit(); });
  sendBtn.addEventListener("click", submit);
}

// ─── RIGHT PANEL ──────────────────────────
function renderRightPanel() {
  const cu = state.currentUser;
  const myPosts = state.posts.filter(p => p.userId === cu.id);

  document.getElementById("stat-posts").textContent =
    myPosts.length;
  document.getElementById("stat-likes").textContent =
    myPosts.reduce((a, p) => a + p.likes_count, 0);

  const topPosts = document.getElementById("top-posts");
  topPosts.innerHTML = "";

  const sorted = [...state.posts].sort((a, b) => b.likes_count - a.likes_count).slice(0, 5);
  sorted.forEach(post => {
    const author = getUser(post.userId);
    const card = document.createElement("div");
    card.className = "top-post-card";

    const authorRow = document.createElement("div");
    authorRow.className = "top-post-author";
    authorRow.appendChild(createAvatar(author, 20));
    const nameEl = document.createElement("span");
    nameEl.className = "top-post-name";
    nameEl.textContent = author?.name ?? "?";
    authorRow.appendChild(nameEl);

    const textEl = document.createElement("div");
    textEl.className = "top-post-text";
    textEl.textContent = post.message;

    const likesEl = document.createElement("div");
    likesEl.className = "top-post-likes";
    likesEl.textContent = `♥ ${post.likes_count}`;

    card.appendChild(authorRow);
    card.appendChild(textEl);
    card.appendChild(likesEl);

    card.addEventListener("click", () => {
      gotoProfile(post.userId);
      if (!state.openCmts.has(post.id)) toggleCmts(post.id);
    });

    topPosts.appendChild(card);
  });
}

// ══════════════════════════════════════════
// AÇÕES
// ══════════════════════════════════════════
function handleLogout() {
  state.currentUser = null;
  state.likedSet    = new Set();
  state.openCmts    = new Set();
  state.view        = "feed";
  state.profileId   = null;
  state.authMode    = "login";

  // Limpa campos de auth
  ["auth-name","auth-email","auth-password"].forEach(id => {
    document.getElementById(id).value = "";
  });
  setAuthError("");
  applyAuthMode();

  document.getElementById("auth-screen").style.display = "flex";
  document.getElementById("app-screen").style.display  = "none";
}

function handlePost() {
  const textarea = document.getElementById("new-post-input");
  const text = textarea.value.trim();
  if (!text || !state.currentUser) return;

  state.posts.unshift({
    id: _postId++,
    userId: state.currentUser.id,
    message: text,
    likes_count: 0,
    comments_count: 0,
    comments: [],
    createdAt: new Date(),
  });

  textarea.value = "";
  document.getElementById("publish-btn").disabled = true;
  refreshApp();
}

function handleLike(postId) {
  const was = state.likedSet.has(postId);
  if (was) state.likedSet.delete(postId);
  else state.likedSet.add(postId);

  const post = state.posts.find(p => p.id === postId);
  if (post) post.likes_count += was ? -1 : 1;

  refreshApp();
}

function handleComment(postId, text) {
  if (!text || !state.currentUser) return;
  const c = { id: _commentId++, userId: state.currentUser.id, message: text, createdAt: new Date() };
  const post = state.posts.find(p => p.id === postId);
  if (!post) return;
  post.comments.push(c);
  post.comments_count += 1;
  refreshApp();
}

function toggleCmts(postId) {
  if (state.openCmts.has(postId)) state.openCmts.delete(postId);
  else state.openCmts.add(postId);
  refreshApp();
}

function gotoProfile(userId) {
  state.view      = "profile";
  state.profileId = userId;
  refreshApp();
}

function gotoFeed() {
  state.view      = "feed";
  state.profileId = null;
  refreshApp();
}

/** Re-renderiza apenas as partes dinâmicas do app */
function refreshApp() {
  renderUserList();
  renderFeedColumn();
  renderRightPanel();
}

// ══════════════════════════════════════════
// UTILITÁRIO
// ══════════════════════════════════════════
function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ══════════════════════════════════════════
// INICIALIZAÇÃO
// ══════════════════════════════════════════
document.addEventListener("DOMContentLoaded", () => {
  renderAuth();
});
