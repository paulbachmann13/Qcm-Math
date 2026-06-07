/* =========================================================
   Moteur de QCM — data-driven
   Pour AJOUTER un QCM : voir README.md
   ========================================================= */

const LETTERS = ["A", "B", "C", "D", "E", "F"];
const app   = document.getElementById("app");
const subEl = document.getElementById("sub");

// mode : "normal" | "general" | "simulation"
const state = {
  catalog:  [],
  level:    null,
  quiz:     null,
  mode:     "normal",
  idx:      0,
  score:    0,
  answered: false,
  answers:  [],
};

/* ---------- Persistance ---------- */
function bestKey(id) { return "qcm.best." + id; }
function getBest(id) {
  try { const r = localStorage.getItem(bestKey(id)); return r ? JSON.parse(r) : null; }
  catch (e) { return null; }
}
function setBest(id, score, total) {
  try { localStorage.setItem(bestKey(id), JSON.stringify({ score, total })); }
  catch (e) {}
}

/* ---------- Utilitaires ---------- */
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/* ---------- Chargement ---------- */
async function fetchJSON(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error("HTTP " + res.status + " — " + url);
  return res.json();
}

async function init() {
  app.innerHTML = `<div class="card"><div class="loading"><div class="spinner"></div>Chargement…</div></div>`;
  let manifest;
  try { manifest = await fetchJSON("data/manifest.json"); }
  catch (e) { return showLoadError(e); }
  if (subEl && manifest.tagline) subEl.textContent = manifest.tagline;

  const catalog = [];
  for (const lvl of manifest.levels) {
    const quizzes = await Promise.all(
      (lvl.quizzes || []).map(async (q) => {
        try   { return { id: q.id, file: q.file, data: await fetchJSON(q.file) }; }
        catch (e) { return { id: q.id, file: q.file, error: true }; }
      })
    );
    catalog.push({ ...lvl, quizzes });
  }
  state.catalog = catalog;
  renderLevelList();
}

function showLoadError(e) {
  app.innerHTML = `
    <div class="card barred"><div class="errbox">
      <p style="font-weight:700;margin-bottom:8px">Impossible de charger les QCM.</p>
      <p>L'appli doit être servie par un serveur web (GitHub Pages fonctionne directement).</p>
      <p style="margin-top:10px">Pour tester en local :</p>
      <code>python3 -m http.server</code>
      <p style="margin-top:14px;font-size:12px;opacity:.8">${e?.message || ""}</p>
    </div></div>`;
}

/* =====================================================
   ÉCRAN 1 — Liste des niveaux
   ===================================================== */
function renderLevelList() {
  state.level = null; state.quiz = null;

  const cards = state.catalog.map((lvl) => {
    const validQuizzes = lvl.quizzes.filter(q => q.data);
    const totalQ = validQuizzes.reduce((s, q) => s + q.data.questions.length, 0);
    const n = validQuizzes.length;
    return `
      <button class="level-card pop" data-level-id="${lvl.id}" style="border-left-color:${lvl.color}">
        <div class="lc-icon" style="background:${lvl.color}">${lvl.icon || "✓"}</div>
        <div class="lc-body">
          <div class="lc-name">${lvl.name}</div>
          <div class="lc-meta">${n} thème${n > 1 ? "s" : ""} · ${totalQ} questions</div>
        </div>
        <span class="lc-arrow">→</span>
      </button>`;
  }).join("");

  app.innerHTML = `<div class="pop">${cards}</div>`;

  document.querySelectorAll(".level-card").forEach(b => {
    b.onclick = () => {
      const lvl = state.catalog.find(l => l.id === b.dataset.levelId);
      renderLevelPage(lvl);
    };
  });
}

/* =====================================================
   ÉCRAN 2 — Page d'un niveau
   ===================================================== */
function renderLevelPage(level) {
  state.level = level;

  /* Carte entraînement général (spé maths) */
  let generalHTML = "";
  if (level.general_training) {
    const cfg    = level.general_training;
    const valid  = level.quizzes.filter(q => q.data);
    const totalQ = cfg.total || (cfg.questions_per_quiz || 5) * valid.length;
    const best   = getBest("general-" + level.id);
    const bestBadge = best ? `<span class="best">Record ${best.score}/${best.total}</span>` : "";
    generalHTML = `
      <div class="section-label">Entraînement général</div>
      <button class="quiz-card general" data-action="general"
              style="border-left-color:${level.color}">
        <div class="body">
          <div class="qt">⚡ Session aléatoire</div>
          <div class="qd">Tirage équilibré sur tous les thèmes — chaque session est différente.</div>
        </div>
        <div class="side"><span class="count">${totalQ} Q</span>${bestBadge}</div>
        <span class="arrow">→</span>
      </button>`;
  }

  /* Carte simulation brevet */
  let simulHTML = "";
  if (level.simulation_brevet) {
    const cfg  = level.simulation_brevet;
    const best = getBest("simulation-" + level.id);
    const bestBadge = best ? `<span class="best">Record ${best.score}/${best.total}</span>` : "";
    simulHTML = `
      <div class="section-label">Simulation examen</div>
      <button class="quiz-card simulation" data-action="simulation"
              style="border-left-color:${level.color}">
        <div class="body">
          <div class="qt">📝 Simulation brevet</div>
          <div class="qd">${cfg.description || "Tirage aléatoire dans toute la base."}</div>
        </div>
        <div class="side"><span class="count">${cfg.total} Q</span>${bestBadge}</div>
        <span class="arrow">→</span>
      </button>`;
  }

  /* Cartes par thème */
  const hasSpecial = level.general_training || level.simulation_brevet;
  const themeLabel = hasSpecial
    ? `<div class="section-label" style="margin-top:22px">Par thème</div>` : "";

  const themeCards = level.quizzes.map((q) => {
    if (q.error || !q.data) {
      return `<div class="quiz-card dead" style="border-left-color:${level.color}">
        <div class="body"><div class="qt">Fichier indisponible</div>
        <div class="qd">${q.file}</div></div></div>`;
    }
    const n    = q.data.questions.length;
    const best = getBest(q.id);
    const bestBadge = best ? `<span class="best">Record ${best.score}/${best.total}</span>` : "";
    return `<button class="quiz-card" data-quiz="${q.id}" style="border-left-color:${level.color}">
      <div class="body">
        <div class="qt">${q.data.title}</div>
        <div class="qd">${q.data.description || ""}</div>
      </div>
      <div class="side"><span class="count">${n} Q</span>${bestBadge}</div>
      <span class="arrow">→</span>
    </button>`;
  }).join("");

  app.innerHTML = `
    <button class="backlink" id="back-home">← Accueil</button>
    <div class="level-page-head pop" style="border-left-color:${level.color}">
      <div class="lc-icon" style="background:${level.color}">${level.icon || "✓"}</div>
      <div class="lc-name" style="font-size:20px">${level.name}</div>
    </div>
    <div class="pop">
      ${generalHTML}${simulHTML}
      ${themeLabel}${themeCards}
    </div>`;

  document.getElementById("back-home").onclick = renderLevelList;

  document.querySelectorAll(".quiz-card[data-quiz]").forEach(b => {
    b.onclick = () => {
      const quiz = level.quizzes.find(q => q.id === b.dataset.quiz);
      startQuiz(level, quiz, "normal");
    };
  });
  document.querySelectorAll("[data-action='general']").forEach(b => {
    b.onclick = () => startGeneralTraining(level);
  });
  document.querySelectorAll("[data-action='simulation']").forEach(b => {
    b.onclick = () => startSimulationBrevet(level);
  });
}

/* =====================================================
   MODES SPÉCIAUX
   ===================================================== */

/* Entraînement général — tirage équilibré avec total exact */
function startGeneralTraining(level) {
  const cfg         = level.general_training;
  const validQuizzes = level.quizzes.filter(q => q.data);
  const n           = validQuizzes.length;
  if (!n) return;

  /* Répartition équilibrée pour atteindre exactement `total` questions */
  const total = cfg.total || (cfg.questions_per_quiz || 5) * n;
  const base  = Math.floor(total / n);
  const extra = total % n;    // les `extra` premiers thèmes ont base+1 questions

  const pool = [];
  validQuizzes.forEach((quiz, i) => {
    const pick = base + (i < extra ? 1 : 0);
    const qs   = quiz.data.questions.map(q => ({ ...q, theme: quiz.data.title }));
    shuffle(qs);
    pool.push(...qs.slice(0, Math.min(pick, qs.length)));
  });
  shuffle(pool);

  startQuiz(level, {
    id:   "general-" + level.id,
    data: { title: "Entraînement général", questions: pool }
  }, "general");
}

/* Simulation brevet — tirage libre */
function startSimulationBrevet(level) {
  const total = level.simulation_brevet?.total || 10;
  const pool  = [];
  for (const quiz of level.quizzes) {
    if (!quiz.data) continue;
    pool.push(...quiz.data.questions.map(q => ({ ...q, theme: quiz.data.title })));
  }
  if (!pool.length) return;
  shuffle(pool);
  startQuiz(level, {
    id:   "simulation-" + level.id,
    data: { title: "Simulation brevet", questions: pool.slice(0, total) }
  }, "simulation");
}

/* =====================================================
   DÉROULÉ D'UN QCM
   ===================================================== */
function startQuiz(level, quiz, mode = "normal") {
  state.level    = level;
  state.quiz     = quiz;
  state.mode     = mode;
  state.idx      = 0;
  state.score    = 0;
  state.answered = false;
  state.answers  = new Array(quiz.data.questions.length).fill(null);
  renderQuestion();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderQuestion() {
  state.answered = false;
  const quiz     = state.quiz.data;
  const Q        = quiz.questions[state.idx];
  const total    = quiz.questions.length;
  const progress = (state.idx / total) * 100;
  const secLabel = Q.theme || quiz.title;

  app.innerHTML = `
    <button class="backlink" id="back">← ${state.level.name}</button>
    <div class="card barred pop">
      <div class="topbar">
        <span>Question ${state.idx + 1} / ${total}</span>
        <span class="sec">${secLabel}</span>
      </div>
      <div class="bar"><i id="bar"></i></div>
      <div class="qnum">${quiz.title} · score ${state.score}/${state.idx}</div>
      <div class="qtext">${Q.q}</div>
      <div class="opts">
        ${Q.options.map((o, i) => `
          <button class="opt" data-i="${i}" style="animation:stagger .35s ${0.05 * i}s both">
            <span class="badge">${LETTERS[i]}</span>
            <span class="txt">${o}</span>
            <span class="mark"></span>
          </button>`).join("")}
      </div>
      <div class="explain" id="explain"></div>
      <div class="next-wrap" id="nextwrap"></div>
    </div>`;

  requestAnimationFrame(() => { document.getElementById("bar").style.width = progress + "%"; });
  document.getElementById("back").onclick = () => renderLevelPage(state.level);
  document.querySelectorAll(".opt").forEach(b => b.onclick = () => choose(parseInt(b.dataset.i)));
}

function choose(choice) {
  if (state.answered) return;
  state.answered = true;
  const Q = state.quiz.data.questions[state.idx];
  state.answers[state.idx] = choice;
  if (choice === Q.correct) state.score++;

  document.querySelectorAll(".opt").forEach((b) => {
    const i = parseInt(b.dataset.i);
    b.disabled = true;
    if (i === Q.correct) { b.classList.add("correct"); b.querySelector(".mark").textContent = "✓"; }
    else if (i === choice) { b.classList.add("wrong"); b.querySelector(".mark").textContent = "✗"; }
  });

  const ex = document.getElementById("explain");
  ex.innerHTML = `<b>${choice === Q.correct ? "✓ Correct." : "✗ Pas tout à fait."}</b> ${Q.e || ""}`;
  requestAnimationFrame(() => ex.classList.add("show"));

  const last = state.idx === state.quiz.data.questions.length - 1;
  document.getElementById("nextwrap").innerHTML =
    `<button class="btn" id="next">${last ? "Voir mon résultat →" : "Question suivante →"}</button>`;
  document.getElementById("next").onclick = () => {
    if (last) renderResult();
    else { state.idx++; renderQuestion(); window.scrollTo({ top: 0, behavior: "smooth" }); }
  };
}

/* =====================================================
   RÉSULTAT
   ===================================================== */
function renderResult() {
  const quiz  = state.quiz.data;
  const qs    = quiz.questions;
  const total = qs.length;
  const score = state.score;
  const pct   = Math.round((score / total) * 100);

  const prev     = getBest(state.quiz.id);
  const isRecord = !prev || score > prev.score;
  if (isRecord) setBest(state.quiz.id, score, total);

  /* Bilan par thème */
  const hasThemes = qs.some(q => q.theme);
  let breakdownHTML = "";
  if (hasThemes) {
    const themes = {};
    qs.forEach((q, i) => {
      const t = q.theme || "Autres";
      if (!themes[t]) themes[t] = { ok: 0, tot: 0 };
      themes[t].tot++;
      if (state.answers[i] === q.correct) themes[t].ok++;
    });
    const rows = Object.entries(themes).map(([name, d]) => {
      const p = Math.round((d.ok / d.tot) * 100);
      return `<div class="brow">
        <div class="top"><span>${name}</span><span class="v">${d.ok}/${d.tot}</span></div>
        <div class="track"><i data-w="${p}" style="background:${state.level.color}"></i></div>
      </div>`;
    }).join("");
    breakdownHTML = `<div class="breakdown"><h3>Résultats par thème</h3>${rows}</div>`;
  }

  /* Note /10 pour la simulation brevet */
  const isSim    = state.mode === "simulation";
  const noteHTML = isSim
    ? `<div class="sim-note">Note : <b>${score} / 10</b></div>` : "";

  /* Récap des erreurs */
  const wrong = qs.reduce((acc, q, i) => {
    if (state.answers[i] !== q.correct) acc.push({ i, q }); return acc;
  }, []);
  const recapHTML = wrong.length === 0
    ? `<div class="perfect">🎉 Sans-faute !</div>`
    : `<div class="recap"><h3>À revoir (${wrong.length})</h3>` +
      wrong.map(({ i, q }) => `<div class="recap-item">
        <b>Q${i + 1}${q.theme ? " · " + q.theme : ""}</b> — Bonne réponse :
        <span class="good">${LETTERS[q.correct]}. ${q.options[q.correct]}</span>
      </div>`).join("") + `</div>`;

  let verdict, vsub;
  if (pct >= 90)      { verdict = "Excellent !";            vsub = "Enchaîne sur un autre thème."; }
  else if (pct >= 70) { verdict = "Très bien.";              vsub = "Quelques points à consolider."; }
  else if (pct >= 50) { verdict = "Pas mal — ça avance.";    vsub = "Reprends tes erreurs puis recommence."; }
  else                { verdict = "Encore du travail.";       vsub = "Revois la notion, une question à la fois."; }

  const againLabel = {
    general:    "Nouvelle session aléatoire",
    simulation: "Nouvelle simulation",
    normal:     "Recommencer ce QCM",
  }[state.mode];

  app.innerHTML = `
    <button class="backlink" id="back">← ${state.level.name}</button>
    <div class="card barred pop result">
      <div class="score-ring"><span id="cnt">0</span><small>/${total}</small></div>
      <div class="pct">${pct}% de réussite — ${quiz.title}</div>
      ${noteHTML}
      ${isRecord && prev ? `<div class="newbest">★ Nouveau record</div>` : ""}
      <div class="verdict">${verdict}</div>
      <div class="verdict-sub">${vsub}</div>
      ${breakdownHTML}
      ${recapHTML}
      <button class="btn gold" id="again">${againLabel}</button>
      <div style="height:10px"></div>
      <button class="btn ghost" id="level">← Retour au niveau</button>
    </div>`;

  let c = 0;
  const iv = setInterval(() => {
    c += Math.max(1, Math.round(score / 22));
    if (c >= score) { c = score; clearInterval(iv); }
    const el = document.getElementById("cnt"); if (el) el.textContent = c;
  }, 35);
  setTimeout(() => {
    document.querySelectorAll(".brow .track i").forEach(el => el.style.width = el.dataset.w + "%");
  }, 200);

  document.getElementById("back").onclick  = () => renderLevelPage(state.level);
  document.getElementById("level").onclick = () => renderLevelPage(state.level);
  document.getElementById("again").onclick = () => {
    if (state.mode === "general")         startGeneralTraining(state.level);
    else if (state.mode === "simulation") startSimulationBrevet(state.level);
    else startQuiz(state.level, state.quiz, "normal");
  };
}

init();
