/* ═══════════════════════════════════════════
   FOCUSSTUDY — APP.JS
   Toda lógica de UI, estado e interações
   ⚠ Funções marcadas com [BACKEND] precisam
     de integração com API/servidor
═══════════════════════════════════════════ */

'use strict';

// ──────────────────────────────────────────
// ESTADO GLOBAL
// ──────────────────────────────────────────
const State = {
  currentView: 'dashboard',
  energy: null,
  availableTime: null,

  session: {
    active: false,
    subject: null,
    cardIndex: 0,
    cards: [],
    correctCount: 0,
    hardCount: 0,
    wrongCount: 0,
    timerSeconds: 0,
    timerMax: 0,
    timerRunning: false,
    timerInterval: null,
    phase: 'study', // 'study' | 'break'
    paused: false,
  },

  procTimer: null,
  lastActivity: Date.now(),
  procAlertShown: false,

  streak: 7,  // [BACKEND] buscar de /api/user/streak

  // [BACKEND] matérias viriam de /api/subjects
  subjects: [
    { id: 1, name: 'Matemática',    color: '#7C3AED', total: 45, mastered: 30, weak: 5,  retention: 82 },
    { id: 2, name: 'Português',     color: '#0EA5E9', total: 38, mastered: 25, weak: 3,  retention: 74 },
    { id: 3, name: 'História',      color: '#F59E0B', total: 52, mastered: 35, weak: 8,  retention: 68 },
    { id: 4, name: 'Química',       color: '#EF4444', total: 60, mastered: 28, weak: 14, retention: 55 },
    { id: 5, name: 'Biologia',      color: '#4ADE80', total: 42, mastered: 24, weak: 6,  retention: 70 },
  ],

  // [BACKEND] dados reais viriam de /api/analytics/weekly
  weeklyData: [
    { day: 'Seg', cards: 22 },
    { day: 'Ter', cards: 35 },
    { day: 'Qua', cards: 18 },
    { day: 'Qui', cards: 41 },
    { day: 'Sex', cards: 29 },
    { day: 'Sáb', cards: 15 },
    { day: 'Dom', cards: 38, today: true },
  ],

  // [BACKEND] pontos fracos viriam de /api/analytics/weak-points
  weakPoints: [
    { subject: 'Química',  topic: 'Estequiometria',           errors: 7 },
    { subject: 'História', topic: 'Segunda Guerra Mundial',    errors: 5 },
    { subject: 'Química',  topic: 'Ligações Iônicas',          errors: 4 },
    { subject: 'Matemática', topic: 'Logaritmos',             errors: 3 },
    { subject: 'Biologia', topic: 'Divisão Celular',           errors: 3 },
  ],
};

// ──────────────────────────────────────────
// FLASHCARDS — banco de dados local
// [BACKEND] substituir por /api/cards?subject=X&energy=Y&time=Z
// ──────────────────────────────────────────
const FLASHCARD_BANK = {
  'Matemática': [
    {
      question: 'O que é logaritmo de um número N na base B?',
      answer: 'O expoente ao qual se deve elevar a base B para obter N. Se Bˣ = N, então log_B(N) = x.',
      feynman: 'Tente explicar logaritmos para uma criança de 10 anos usando uma história sobre crescimento de dinheiro.',
    },
    {
      question: 'Qual é a propriedade do produto dos logaritmos?',
      answer: 'log_B(M·N) = log_B(M) + log_B(N). O logaritmo do produto é igual à soma dos logaritmos.',
      feynman: 'Dê um exemplo numérico concreto que prove essa propriedade com log₁₀.',
    },
    {
      question: 'O que é uma função exponencial e como identificar no gráfico?',
      answer: 'f(x) = a·bˣ onde b > 0 e b ≠ 1. No gráfico: cresce rapidamente (b > 1) ou decresce (0 < b < 1), sempre positiva.',
      feynman: 'Cite um fenômeno natural que segue crescimento exponencial e explique por quê.',
    },
  ],
  'Química': [
    {
      question: 'O que é estequiometria?',
      answer: 'Ramo da química que estuda as proporções quantitativas (massa, mol, volume) nas reações químicas, baseado na lei da conservação da massa.',
      feynman: 'Explique estequiometria usando uma receita de bolo como analogia.',
    },
    {
      question: 'Defina ligação iônica e dê um exemplo.',
      answer: 'Ligação entre íons de cargas opostas, formada pela transferência de elétrons. Ex: NaCl — o Na⁺ cede elétron para o Cl⁻.',
      feynman: 'Por que o NaCl se dissolve em água? Explique no nível atômico, como se fosse para um amigo.',
    },
    {
      question: 'Qual a diferença entre mol e massa molar?',
      answer: 'Mol é uma unidade de quantidade (6,02×10²³ entidades). Massa molar é a massa de 1 mol de substância, em g/mol, igual numericamente à massa atômica.',
      feynman: 'Se você tivesse 1 mol de maçãs, como você descreveria essa quantidade em termos do dia a dia?',
    },
  ],
  'História': [
    {
      question: 'Quais foram as principais causas da Segunda Guerra Mundial?',
      answer: 'Crise de 1929, ascensão do nazismo na Alemanha, revanchismo pelo Tratado de Versalhes, expansionismo de Hitler e a política de apaziguamento das potências europeias.',
      feynman: 'Se você fosse um cidadão alemão em 1933, quais problemas do dia a dia facilitariam sua adesão ao discurso nazista?',
    },
    {
      question: 'O que foi a política de "appeasement" na década de 1930?',
      answer: 'Estratégia britânica e francesa de ceder às demandas de Hitler para evitar a guerra, exemplificada no Acordo de Munique (1938) que permitiu a anexação dos Sudetos.',
      feynman: 'Você acha que o appeasement foi uma boa estratégia? Defenda sua posição com argumentos históricos.',
    },
    {
      question: 'Quando e como terminou a Segunda Guerra Mundial?',
      answer: 'Em 1945: Alemanha capitulou em maio após suicídio de Hitler. Japão capitulou em agosto após as bombas atômicas em Hiroshima e Nagasaki. Documentos assinados em setembro de 1945.',
      feynman: 'Explique as consequências imediatas do fim da guerra para o mundo, como se fosse um jornalista em 1945.',
    },
  ],
  'Português': [
    {
      question: 'O que é coesão textual?',
      answer: 'Mecanismo que garante a ligação harmônica entre partes do texto por meio de recursos linguísticos: pronomes, conjunções, sinônimos e elipses.',
      feynman: 'Reescreva este parágrafo ruim usando elementos de coesão: "Maria foi ao mercado. Maria comprou frutas. Maria voltou para casa."',
    },
    {
      question: 'Qual a diferença entre crase e uso do "a" sem crase?',
      answer: 'Crase é a fusão de "a" (preposição) + "a" (artigo feminino). Ocorre antes de palavras femininas que aceitam artigo. Não ocorre antes de verbos, palavras masculinas, pronomes pessoais.',
      feynman: 'Crie 3 frases: uma com crase correta, uma sem crase correta, e explique por que cada uma está certa.',
    },
    {
      question: 'O que é narrador onisciente e em que se diferencia do onisciente intruso?',
      answer: 'Onisciente: sabe tudo sobre os personagens. Onisciente intruso: além de saber tudo, comenta e julga as ações dos personagens, interferindo na narrativa.',
      feynman: 'Escreva o mesmo parágrafo de história duas vezes: uma com narrador onisciente neutro e outra com onisciente intruso.',
    },
  ],
  'Biologia': [
    {
      question: 'O que é mitose e quantas células-filhas ela produz?',
      answer: 'Divisão celular que produz 2 células-filhas geneticamente idênticas à célula-mãe (mesmo número de cromossomos — diploides). Fases: Prófase, Metáfase, Anáfase, Telófase.',
      feynman: 'Por que organismos multicelulares precisam da mitose? Explique com o exemplo de como você cura um arranhão.',
    },
    {
      question: 'Qual a diferença entre DNA e RNA?',
      answer: 'DNA: dupla fita, desoxirribose, base timina (T), fica no núcleo. RNA: fita simples, ribose, base uracila (U), pode sair do núcleo. DNA armazena; RNA executa.',
      feynman: 'Se DNA é o projeto de uma casa, o que seria o RNA? Explique os tipos (mRNA, tRNA, rRNA) com essa analogia.',
    },
  ],
};

const FEYNMAN_FALLBACK = 'Tente explicar este conceito usando apenas palavras simples, como se fosse para alguém que nunca estudou o assunto.';

// Sessões recomendadas por energia/tempo
const RECOMMENDATIONS = {
  high: {
    15:  { title: 'Sprint de Revisão',   desc: 'Revisão rápida dos cards mais errados. Alta intensidade, curta duração.',       subject: 'Química',     cards: 8,  color: '#EF4444' },
    30:  { title: 'Bloco de Dominação',  desc: 'Explore uma matéria nova com foco total. Ideal para conteúdo difícil.',          subject: 'Matemática',  cards: 15, color: '#7C3AED' },
    60:  { title: 'Sessão Completa',     desc: 'Estudo profundo com Pomodoro 25/5. Feynman Technique ativada.',                  subject: 'Química',     cards: 25, color: '#EF4444' },
    120: { title: 'Maratona Inteligente', desc: 'Múltiplos Pomodoros, alterna matérias fracas e fortes. Revisão espaçada.',      subject: 'Todas',       cards: 50, color: '#7C3AED' },
  },
  medium: {
    15:  { title: 'Aquecimento Suave',   desc: 'Cards fáceis para entrar no ritmo. Sem pressão, só consistência.',               subject: 'Português',   cards: 6,  color: '#0EA5E9' },
    30:  { title: 'Revisão Direcionada', desc: 'Foco nos pontos fracos identificados pela IA. Curto e eficiente.',               subject: 'História',    cards: 12, color: '#F59E0B' },
    60:  { title: 'Sessão Equilibrada',  desc: 'Mix de matérias com pausas estratégicas. Mantém concentração sem esgotar.',      subject: 'Biologia',    cards: 20, color: '#4ADE80' },
    120: { title: 'Estudo Profundo',     desc: 'Pomodoros com foco em compreensão. Técnica Feynman em cada conceito difícil.',   subject: 'Matemática',  cards: 35, color: '#7C3AED' },
  },
  low: {
    15:  { title: 'Modo Leve',          desc: 'Só revisão do que você já sabe. Reforce memórias sem esforço mental.',            subject: 'Português',   cards: 5,  color: '#0EA5E9' },
    30:  { title: 'Revisão Passiva',    desc: 'Cards fáceis e médios. Construa confiança antes de descansar.',                   subject: 'Biologia',    cards: 8,  color: '#4ADE80' },
    60:  { title: 'Estudo Contemplativo', desc: 'Leitura lenta e assimilação. Sem pressão. Técnica Feynman escrita.',            subject: 'História',    cards: 12, color: '#F59E0B' },
    120: { title: 'Não recomendado',    desc: 'Com energia baixa, 2 horas não são eficientes. Considere uma sessão de 30 min.', subject: 'Qualquer',    cards: 10, color: '#6B6B7A' },
  },
};

// ──────────────────────────────────────────
// UTILS
// ──────────────────────────────────────────
const $ = id => document.getElementById(id);
const $$ = sel => document.querySelectorAll(sel);

function showToast(msg, duration = 2800) {
  const t = $('toast');
  $('toast-msg').textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => t.classList.add('hidden'), duration);
}

function pad2(n) { return String(n).padStart(2, '0'); }

function formatTime(s) { return `${pad2(Math.floor(s / 60))}:${pad2(s % 60)}`; }

function greetingByHour() {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

function resetActivity() {
  State.lastActivity = Date.now();
  if (State.procAlertShown) {
    $('proc-alert').classList.add('hidden');
    State.procAlertShown = false;
  }
}

// ──────────────────────────────────────────
// NAVEGAÇÃO
// ──────────────────────────────────────────
function navigateTo(viewName) {
  // Hide all views
  $$('.view').forEach(v => v.classList.remove('active'));
  $$('.nav-item').forEach(n => n.classList.remove('active'));

  // Show target
  const view = $(`view-${viewName}`);
  if (!view) return;
  view.classList.add('active');

  // Highlight nav
  const navItem = document.querySelector(`.nav-item[data-view="${viewName}"]`);
  if (navItem) navItem.classList.add('active');

  State.currentView = viewName;
  resetActivity();

  // Render content for the view
  if (viewName === 'progress') renderProgress();
  if (viewName === 'materials') renderMaterials();
}

// Bind nav items
$$('.nav-item').forEach(item => {
  item.addEventListener('click', () => navigateTo(item.dataset.view));
});

// Link buttons inside views
document.addEventListener('click', e => {
  const el = e.target.closest('[data-goto]');
  if (el) navigateTo(el.dataset.goto);
});

// ──────────────────────────────────────────
// DASHBOARD — SETUP
// ──────────────────────────────────────────
function bindEnergyButtons() {
  $$('.energy-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.energy-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      State.energy = btn.dataset.energy;
      updateRecommendation();
      resetActivity();
    });
  });
}

function bindTimeButtons() {
  $$('.time-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.time-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      State.availableTime = parseInt(btn.dataset.time);
      updateRecommendation();
      resetActivity();
    });
  });
}

function updateRecommendation() {
  const { energy, availableTime } = State;
  const startBtn = $('btn-start-session');

  if (!energy || !availableTime) {
    $('rec-title').textContent = 'Selecione sua energia e tempo disponível';
    $('rec-desc').textContent = 'O FocusStudy vai montar a sessão perfeita para você agora.';
    $('rec-meta').innerHTML = '';
    startBtn.disabled = true;
    return;
  }

  const rec = RECOMMENDATIONS[energy][availableTime];
  $('rec-title').textContent = rec.title;
  $('rec-desc').textContent  = rec.desc;

  // Meta tags
  $('rec-meta').innerHTML = `
    <div class="rec-meta-item">
      <div class="dot" style="background:${rec.color}"></div>
      ${rec.subject}
    </div>
    <div class="rec-meta-item">🃏 ${rec.cards} cards</div>
    <div class="rec-meta-item">⏱️ ${availableTime} min</div>
    <div class="rec-meta-item">
      ${ energy === 'high'   ? '⚡ Alta intensidade'
       : energy === 'medium' ? '🔆 Intensidade média'
       : '🌙 Ritmo leve' }
    </div>
  `;

  startBtn.disabled = false;
}

// ──────────────────────────────────────────
// SUBJECTS — render
// ──────────────────────────────────────────
function renderSubjectsGrid(containerId, limit) {
  const container = $(containerId);
  if (!container) return;
  const subs = limit ? State.subjects.slice(0, limit) : State.subjects;

  container.innerHTML = subs.map(sub => {
    const pct = Math.round((sub.mastered / sub.total) * 100);
    return `
      <div class="subject-card" style="--subj-color:${sub.color}"
           onclick="startSubjectSession(${sub.id})">
        <div class="subject-card-name" style="color:${sub.color}">${sub.name}</div>
        <div class="subject-card-bar">
          <div class="subject-card-fill" style="width:${pct}%;background:${sub.color}"></div>
        </div>
        <div class="subject-card-meta">
          <span>${sub.mastered}/${sub.total} cards</span>
          <span style="color:${sub.weak > 5 ? 'var(--red)' : 'var(--text-muted)'}">
            ${sub.weak} fracos
          </span>
        </div>
      </div>
    `;
  }).join('');
}

function startSubjectSession(subjectId) {
  const sub = State.subjects.find(s => s.id === subjectId);
  if (!sub) return;

  // Pre-select subject & navigate to session
  navigateTo('session');
  launchSession(sub.name, 25 * 60, sub.color);
}

// ──────────────────────────────────────────
// SESSION
// ──────────────────────────────────────────
function launchSession(subjectName, durationSeconds, accentColor) {
  const s = State.session;

  // Reset session state
  s.active       = true;
  s.subject      = subjectName;
  s.cardIndex    = 0;
  s.correctCount = 0;
  s.hardCount    = 0;
  s.wrongCount   = 0;
  s.timerSeconds = durationSeconds;
  s.timerMax     = durationSeconds;
  s.phase        = 'study';
  s.paused       = false;

  // Get cards for this subject
  const bankKey  = Object.keys(FLASHCARD_BANK).find(k => subjectName.includes(k)) || Object.keys(FLASHCARD_BANK)[0];
  s.cards        = [...FLASHCARD_BANK[bankKey]];
  // [BACKEND] substituir por: GET /api/cards?subject=X&energy=Y → lista de flashcards

  // Show active screen
  $('session-setup-screen').classList.add('hidden');
  $('session-active-screen').classList.remove('hidden');
  $('session-summary').classList.add('hidden');
  $('session-active-screen').style.display = 'flex';

  // Update UI
  $('sess-subject-tag').textContent = subjectName;
  if (accentColor) {
    $('sess-subject-tag').style.color = accentColor;
    $('sess-subject-tag').style.background = `${accentColor}18`;
    $('sess-subject-tag').style.borderColor = `${accentColor}30`;
    $('timer-ring-fill').style.stroke = accentColor;
    $('timer-ring-fill').style.filter = `drop-shadow(0 0 6px ${accentColor})`;
  }

  loadCard(0);
  startTimer();
}

function loadCard(index) {
  const s = State.session;
  if (index >= s.cards.length) {
    endSession();
    return;
  }

  const card = s.cards[index];
  s.cardIndex = index;

  // UI
  $('card-question').textContent = card.question;
  $('card-answer').textContent   = card.answer;
  $('feynman-prompt').textContent = card.feynman || FEYNMAN_FALLBACK;

  // Update card count & progress bar
  const pct = (index / s.cards.length) * 100;
  $('sess-progress-bar').style.width = `${pct}%`;
  $('sess-card-count').textContent = `${index + 1} / ${s.cards.length}`;

  // Reset to front
  const fc = $('flashcard');
  fc.dataset.flipped = 'false';
  $('flashcard-back') && hideBack();

  $('answer-btns').style.display = 'none';
  $('btn-flip').style.display    = 'inline-flex';
}

function hideBack() {
  // Show front, hide back
  $('flashcard').querySelector('.flashcard-back').style.display = 'none';
  $('flashcard').querySelector('.flashcard-front').style.display = 'block';
}

// Flip card
$('btn-flip').addEventListener('click', () => {
  const fc = $('flashcard');
  fc.dataset.flipped = 'true';
  fc.querySelector('.flashcard-front').style.display = 'none';
  fc.querySelector('.flashcard-back').style.display  = 'block';
  $('btn-flip').style.display    = 'none';
  $('answer-btns').style.display = 'flex';
  resetActivity();
});

// Answer buttons
$('btn-correct').addEventListener('click', () => recordAnswer('correct'));
$('btn-hard').addEventListener('click',    () => recordAnswer('hard'));
$('btn-wrong').addEventListener('click',   () => recordAnswer('wrong'));

function recordAnswer(result) {
  const s = State.session;
  if (result === 'correct') s.correctCount++;
  else if (result === 'hard') s.hardCount++;
  else s.wrongCount++;

  // [BACKEND] POST /api/cards/{id}/review → { result, userId } → SRS atualizado

  // Next card
  loadCard(s.cardIndex + 1);
  resetActivity();
}

// Pause
$('btn-pause-session').addEventListener('click', () => {
  const s = State.session;
  s.paused = !s.paused;
  if (s.paused) {
    clearInterval(s.timerInterval);
    $('btn-pause-session').innerHTML = `
      <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
        <polygon points="5 3 19 12 5 21 5 3"/>
      </svg>`;
    showToast('⏸ Sessão pausada');
  } else {
    startTimer();
    $('btn-pause-session').innerHTML = `
      <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
        <rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>
      </svg>`;
    showToast('▶ Sessão retomada');
  }
});

// Quick Start Button (session view)
$('btn-quick-start').addEventListener('click', () => {
  launchSession('Química', 25 * 60, '#EF4444');
});

// Start from dashboard
$('btn-start-session').addEventListener('click', () => {
  const { energy, availableTime } = State;
  if (!energy || !availableTime) return;

  const rec  = RECOMMENDATIONS[energy][availableTime];
  const secs = availableTime * 60;

  navigateTo('session');
  launchSession(rec.subject === 'Todas' ? 'Química' : rec.subject, secs, rec.color);
});

// New session after summary
$('btn-new-session').addEventListener('click', () => {
  navigateTo('dashboard');
  $('session-summary').classList.add('hidden');
  $('session-active-screen').classList.add('hidden');
  $('session-setup-screen').classList.remove('hidden');
});

// ──────────────────────────────────────────
// TIMER
// ──────────────────────────────────────────
function startTimer() {
  const s = State.session;
  clearInterval(s.timerInterval);

  s.timerInterval = setInterval(() => {
    if (s.paused) return;
    s.timerSeconds--;

    updateTimerDisplay(s.timerSeconds, s.timerMax);

    if (s.timerSeconds <= 0) {
      clearInterval(s.timerInterval);

      if (s.phase === 'study') {
        // Switch to break
        s.phase        = 'break';
        s.timerSeconds = 5 * 60;
        s.timerMax     = 5 * 60;
        $('timer-sublabel').textContent = 'pausa';
        $('sess-phase-label').textContent = 'Intervalo';
        $('timer-ring-fill').style.stroke = 'var(--green)';
        $('timer-ring-fill').style.filter = 'drop-shadow(0 0 6px var(--green))';
        showToast('☕ Pausa de 5 minutos! Afaste os olhos da tela.');
        startTimer();
      } else {
        // Break ended → back to study
        s.phase        = 'study';
        s.timerSeconds = 25 * 60;
        s.timerMax     = 25 * 60;
        $('timer-sublabel').textContent = 'foco';
        $('sess-phase-label').textContent = 'Sessão de Estudo';
        $('timer-ring-fill').style.stroke = 'var(--accent)';
        $('timer-ring-fill').style.filter = 'drop-shadow(0 0 6px var(--accent))';
        showToast('🎯 Hora de focar novamente!');
        startTimer();
      }
    }
  }, 1000);
}

function updateTimerDisplay(seconds, total) {
  $('timer-display').textContent = formatTime(seconds);

  // SVG ring — circumference of r=52 is ~326.7
  const circ   = 326.7;
  const filled = (1 - seconds / total) * circ;
  $('timer-ring-fill').style.strokeDashoffset = filled;
}

function endSession() {
  const s = State.session;
  clearInterval(s.timerInterval);
  s.active = false;

  // [BACKEND] POST /api/sessions/complete → { correct, hard, wrong, subject, duration }

  // Hide cards, show summary
  $('flashcard-area').style.display = 'none';
  $('answer-btns').style.display    = 'none';
  $('session-timer-wrap').style.display = 'none';
  $('session-header').style.display = 'none';

  const total   = s.correctCount + s.hardCount + s.wrongCount;
  const pctOk   = total > 0 ? Math.round((s.correctCount / total) * 100) : 0;

  let emoji = '🎉', title = 'Sessão Completa!', msg = '';

  if (pctOk >= 80) {
    emoji = '🏆'; title = 'Excelente desempenho!';
    msg   = `Você acertou ${pctOk}% dos cards. Continue assim e esse assunto será seu aliado!`;
  } else if (pctOk >= 50) {
    emoji = '📈'; title = 'Bom progresso!';
    msg   = `${pctOk}% de acertos. Os ${s.wrongCount} erros foram adicionados à fila de revisão prioritária.`;
  } else {
    emoji = '💪'; title = 'Hora de reforçar!';
    msg   = `Só ${pctOk}% de acertos — normal para conteúdo novo. A IA vai priorizar esses conceitos.`;
  }

  // Generate insight
  let insight = '';
  if (s.wrongCount > 2) {
    insight = `⚠️ <b>Atenção:</b> ${s.wrongCount} conceitos precisam de revisão. A próxima sessão recomendada foca neles primeiro.`;
  } else if (s.hardCount > s.correctCount) {
    insight = `🧩 Muitos cards "difíceis" — tente a Técnica Feynman: explique o conceito em voz alta com suas próprias palavras.`;
  } else {
    insight = `✅ Ótima retenção! Os cards dominados foram espaçados automaticamente para a próxima revisão.`;
  }

  $('summary-emoji').textContent        = emoji;
  $('summary-title').textContent        = title;
  $('summary-msg').textContent          = msg;
  $('sum-correct').textContent          = s.correctCount;
  $('sum-hard').textContent             = s.hardCount;
  $('sum-wrong').textContent            = s.wrongCount;
  $('summary-insight').innerHTML        = insight;
  $('session-summary').classList.remove('hidden');

  // Update streak
  State.streak++;
  $('sidebar-streak').textContent = State.streak;
  $('streak-big').textContent     = State.streak;
}

// ──────────────────────────────────────────
// MATERIAIS
// ──────────────────────────────────────────
function renderMaterials() {
  const container = $('subjects-full-list');
  container.innerHTML = State.subjects.map(sub => {
    const pct = Math.round((sub.mastered / sub.total) * 100);
    return `
      <div class="subject-full-card">
        <div class="subj-color-dot" style="background:${sub.color}"></div>
        <div class="subj-info">
          <div class="subj-name">${sub.name}</div>
          <div class="subj-meta">${sub.total} cards · ${sub.mastered} dominados</div>
        </div>
        <div class="subj-bar-wrap">
          <div class="subj-bar-label">
            <span>Progresso</span><span>${pct}%</span>
          </div>
          <div class="subj-bar-bg">
            <div class="subj-bar-fill" style="width:${pct}%;background:${sub.color}"></div>
          </div>
        </div>
        ${sub.weak > 3
          ? `<div class="subj-weak-badge">⚠ ${sub.weak} fracos</div>`
          : ''}
      </div>
    `;
  }).join('');
}

// Upload area (simulated — BACKEND real necessário)
$('upload-area').addEventListener('click', () => {
  // [BACKEND] Abrir input de arquivo e enviar para POST /api/materials/upload
  simulateUpload();
});

$('btn-upload').addEventListener('click', e => {
  e.stopPropagation();
  simulateUpload();
});

function simulateUpload() {
  // [BACKEND] Aqui você faria:
  // 1. Abrir input file
  // 2. FormData com o arquivo
  // 3. POST /api/materials/upload
  // 4. Receber flashcards gerados pela IA
  // 5. Adicionar à matéria correta
  $('processing-card').classList.remove('hidden');
  showToast('📤 Processando material... (demo)');

  setTimeout(() => {
    $('processing-card').classList.add('hidden');
    showToast('✅ 12 novos flashcards criados a partir do material!');
  }, 3000);
}

// Add new subject (simulated)
$('btn-add-subject').addEventListener('click', () => {
  // [BACKEND] Modal de criação de matéria → POST /api/subjects
  const name = prompt('Nome da nova matéria:');
  if (!name || !name.trim()) return;
  const colors = ['#06B6D4', '#8B5CF6', '#F43F5E', '#10B981', '#F59E0B'];
  const color  = colors[State.subjects.length % colors.length];
  State.subjects.push({ id: Date.now(), name: name.trim(), color, total: 0, mastered: 0, weak: 0, retention: 0 });
  renderMaterials();
  renderSubjectsGrid('subjects-grid-dash', 3);
  showToast(`✅ Matéria "${name.trim()}" criada!`);
});

// ──────────────────────────────────────────
// PROGRESSO
// ──────────────────────────────────────────
function renderProgress() {
  renderWeeklyChart();
  renderWeakPoints();
  renderStreakCalendar();
  renderRetentionBars();
}

function renderWeeklyChart() {
  const container = $('weekly-chart');
  const max = Math.max(...State.weeklyData.map(d => d.cards));

  container.innerHTML = State.weeklyData.map(d => {
    const pct = (d.cards / max) * 100;
    return `
      <div class="chart-bar-wrap">
        <div class="chart-bar-bg" style="height:${pct}%">
          <div class="chart-bar-fill ${d.today ? 'today' : ''}" 
               data-val="${d.cards}"
               style="height:100%"></div>
        </div>
        <div class="chart-day ${d.today ? 'today-label' : ''}">${d.day}</div>
      </div>
    `;
  }).join('');
}

function renderWeakPoints() {
  const container = $('weak-list');
  container.innerHTML = State.weakPoints.map(w => `
    <div class="weak-item">
      <div>
        <div class="weak-item-subj">${w.subject}</div>
        <div class="weak-item-topic">${w.topic}</div>
      </div>
      <div class="weak-item-err">${w.errors}✗</div>
    </div>
  `).join('');
}

function renderStreakCalendar() {
  const container = $('calendar-grid');
  const today = new Date();
  const dots   = [];

  for (let i = 27; i >= 0; i--) {
    const d    = new Date(today);
    d.setDate(today.getDate() - i);
    // Simulate studied days (studied = not Sunday, with some random gaps)
    const studied = d.getDay() !== 0 && Math.random() > 0.25;
    const isToday = i === 0;
    dots.push(`<div class="cal-dot ${isToday ? 'today' : studied ? 'studied' : ''}" 
               title="${d.toLocaleDateString('pt-BR')}"></div>`);
  }
  container.innerHTML = dots.join('');
}

function renderRetentionBars() {
  const container = $('retention-bars');
  container.innerHTML = State.subjects.map(sub => `
    <div class="ret-bar-item">
      <div class="ret-bar-label">${sub.name}</div>
      <div class="ret-bar-bg">
        <div class="ret-bar-fill" style="width:${sub.retention}%;background:${sub.color}"></div>
      </div>
      <div class="ret-bar-pct" style="color:${sub.color}">${sub.retention}%</div>
    </div>
  `).join('');
}

// ──────────────────────────────────────────
// PROCRASTINATION DETECTOR
// ──────────────────────────────────────────
function initProcrastinationDetector() {
  // Only fire when session is active
  setInterval(() => {
    if (!State.session.active || State.session.paused) return;
    const idleMs = Date.now() - State.lastActivity;
    if (idleMs > 2 * 60 * 1000 && !State.procAlertShown) {
      // 2 minutes of inactivity during active session
      $('proc-alert').classList.remove('hidden');
      State.procAlertShown = true;
    }
  }, 10000); // Check every 10 seconds
}

$('proc-dismiss').addEventListener('click', () => {
  $('proc-alert').classList.add('hidden');
  State.procAlertShown = false;
  resetActivity();
  showToast('🎯 Foco retomado! Você consegue!');
});

// Track any interaction
['click', 'keydown', 'mousemove', 'touchstart'].forEach(evt => {
  document.addEventListener(evt, resetActivity, { passive: true });
});

// ──────────────────────────────────────────
// DATE & HEADER
// ──────────────────────────────────────────
function initHeader() {
  const now  = new Date();
  const opts = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  $('header-date').textContent = now.toLocaleDateString('pt-BR', opts);
  $('greeting-text').textContent = greetingByHour();
}

// ──────────────────────────────────────────
// INICIALIZAÇÃO
// ──────────────────────────────────────────
function init() {
  initHeader();
  bindEnergyButtons();
  bindTimeButtons();
  renderSubjectsGrid('subjects-grid-dash', 3);
  initProcrastinationDetector();

  // Make sure session back states are correct
  $('flashcard').querySelector('.flashcard-back').style.display = 'none';

  // Animate stat numbers on load
  animateNumbers();

  console.log('%c FocusStudy ⚡', 'color: #7C3AED; font-size: 20px; font-weight: bold;');
  console.log('%c App iniciado. Funções marcadas com [BACKEND] precisam de integração de API.', 'color: #8888AA');
}

function animateNumbers() {
  const targets = [
    { el: $('stat-mastered'),  end: 142, suffix: '' },
    { el: $('stat-sessions'),  end: 23,  suffix: '' },
    { el: $('stat-weak'),      end: 8,   suffix: '' },
  ];

  targets.forEach(({ el, end, suffix }) => {
    let current = 0;
    const step  = end / 40;
    const timer = setInterval(() => {
      current = Math.min(current + step, end);
      el.textContent = Math.floor(current) + suffix;
      if (current >= end) clearInterval(timer);
    }, 30);
  });

  // Retention with %
  let retCur = 0;
  const retTimer = setInterval(() => {
    retCur = Math.min(retCur + 2, 78);
    $('stat-retention').innerHTML = `${retCur}<span>%</span>`;
    if (retCur >= 78) clearInterval(retTimer);
  }, 30);
}

// Boot
document.addEventListener('DOMContentLoaded', init);
