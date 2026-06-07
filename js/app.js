/* =========================================================
   Moteur de QCM — data-driven
   Pour AJOUTER un QCM : voir README.md (créer un .json + une
   ligne dans data/manifest.json). Ce fichier ne change pas.
   ========================================================= */

const LETTERS = ["A", "B", "C", "D", "E", "F"];
const app = document.getElementById("app");
const subEl = document.getElementById("sub");

const state = {
  catalog: [],
  level: null,   // niveau courant (objet)
  quiz: null,    // quiz courant (objet contenant .data)
  idx: 0,
  score: 0,
  answered: false,
  answers: [],
};

/* ---------- Persistance (meilleur score) ---------- */
function bestKey(id) { return "qcm.best." + id; }
function getBest(id) {
  try {
    const raw = localStorage.getItem(bestKey(id));
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}
function setBest(id, score, total) {
  try { localStorage.setItem(bestKey(id), JSON.stringify({ score, total })); }
  catch (e) { /* stockage indisponible : on ignore silencieusement */ }
}

/* ---------- Chargement des données ---------- */
async function fetchJSON(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error("HTTP " + res.status + " sur " + url);
  return res.json();
}

async function init() {
  app.innerHTML = `<div class="card"><div class="loading"><div class="spinner"></div>Chargement…</div></div>`;
  let manifest;
  try {
    manifest = await fetchJSON("data/manifest.json");
  } catch (e) {
    return showLoadError(e);
  }
  if (subEl && manifest.tagline) subEl.textContent = manifest.tagline;

  // Charge tous les fichiers de QCM en parallèle, sans bloquer si l'un échoue
  const catalog = [];
  for (const lvl of manifest.levels) {
    const quizzes = await Promise.all(
      (lvl.quizzes || []).map(async (q) => {
        try {
          const data = await fetchJSON(q.file);
          return { id: q.id, file: q.file, data };
        } catch (e) {
          return { id: q.id, file: q.file, error: true };
        }
      })
    );
    catalog.push({ ...lvl, quizzes });
  }
  state.catalog = catalog;
  renderHome();
}

function showLoadError(e) {
  app.innerHTML = `
    <div class="card barred">
      <div class="errbox">
        <p style="font-weight:700;margin-bottom:8px">Impossible de charger les QCM.</p>
        <p>Cette appli lit des fichiers de données : elle doit être servie par un serveur web (c'est automatique sur GitHub&nbsp;Pages).</p>
        <p style="margin-top:10px">Pour tester en local, lance depuis le dossier :</p>
        <code>python3 -m http.server</code>
        <p style="margin-top:14px;font-size:12px;opacity:.8">${(e && e.message) ? e.message : ""}</p>
      </div>
    </div>`;
}

/* ---------- Écran d'accueil ---------- */
function renderHome() {
  state.level = null; state.quiz = null;
  const levelsHTML = state.catalog.map((lvl) => {
    const cards = lvl.quizzes.map((q) => {
      if (q.error || !q.data) {
        return `<div class="quiz-card dead" style="border-left-color:${lvl.color}">
          <div class="body"><div class="qt">Fichier indisponible</div>
          <div class="qd">${q.file}</div></div></div>`;
      }
      const n = q.data.questions.length;
      const best = getBest(q.id);
      const bestHTML = best ? `<span class="best">Record ${best.score}/${best.total}</span>` : "";
      return `<button class="quiz-card" data-level="${lvl.id}" data-quiz="${q.id}" style="border-left-color:${lvl.color}">
        <div class="body">
          <div class="qt">${q.data.title}</div>
          <div class="qd">${q.data.description || ""}</div>
        </div>
        <div class="side">
          <span class="count">${n} Q</span>
          ${bestHTML}
        </div>
        <span class="arrow">→</span>
      </button>`;
    }).join("");

    const total = lvl.quizzes.filter(q => q.data).length;
    return `<section class="level">
      <div class="level-head">
        <div class="level-icon" style="background:${lvl.color}">${lvl.icon || "✓"}</div>
        <div>
          <div class="level-name">${lvl.name}</div>
          <div class="level-count">${total} QCM</div>
        </div>
      </div>
      ${cards}
    </section>`;
  }).join("");

  app.innerHTML = `<div class="pop">${levelsHTML}</div>`;
  document.querySelectorAll(".quiz-card[data-quiz]").forEach((b) => {
    b.onclick = () => {
      const lvl = state.catalog.find(l => l.id === b.dataset.level);
      const quiz = lvl.quizzes.find(q => q.id === b.dataset.quiz);
      startQuiz(lvl, quiz);
    };
  });
}

/* ---------- Déroulé d'un QCM ---------- */
function startQuiz(level, quiz) {
  state.level = level;
  state.quiz = quiz;
  state.idx = 0;
  state.score = 0;
  state.answered = false;
  state.answers = new Array(quiz.data.questions.length).fill(null);
  renderQuestion();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderQuestion() {
  state.answered = false;
  const quiz = state.quiz.data;
  const Q = quiz.questions[state.idx];
  const total = quiz.questions.length;
  const progress = (state.idx / total) * 100;
  const secLabel = Q.theme ? Q.theme : quiz.title;

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
  document.getElementById("back").onclick = renderHome;
  document.querySelectorAll(".opt").forEach((b) => b.onclick = () => choose(parseInt(b.dataset.i)));
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

  const ok = choice === Q.correct;
  const ex = document.getElementById("explain");
  ex.innerHTML = `<b>${ok ? "✓ Correct." : "✗ Pas tout à fait."}</b> ${Q.e || ""}`;
  requestAnimationFrame(() => ex.classList.add("show"));

  const last = state.idx === state.quiz.data.questions.length - 1;
  document.getElementById("nextwrap").innerHTML =
    `<button class="btn" id="next">${last ? "Voir mon résultat →" : "Question suivante →"}</button>`;
  document.getElementById("next").onclick = () => {
    if (last) { renderResult(); }
    else { state.idx++; renderQuestion(); window.scrollTo({ top: 0, behavior: "smooth" }); }
  };
}

/* ---------- Résultat ---------- */
function renderResult() {
  const quiz = state.quiz.data;
  const qs = quiz.questions;
  const total = qs.length;
  const score = state.score;
  const pct = Math.round((score / total) * 100);

  // record
  const prev = getBest(state.quiz.id);
  const isRecord = !prev || score > prev.score;
  if (isRecord) setBest(state.quiz.id, score, total);

  // bilan par thème (si les questions portent un thème)
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

  // récap des erreurs
  const wrong = [];
  qs.forEach((q, i) => { if (state.answers[i] !== q.correct) wrong.push({ i, q }); });
  let recapHTML;
  if (wrong.length === 0) {
    recapHTML = `<div class="perfect">🎉 Sans-faute ! Toutes les réponses sont correctes.</div>`;
  } else {
    recapHTML = `<div class="recap"><h3>À revoir (${wrong.length})</h3>` +
      wrong.map(({ i, q }) => `<div class="recap-item">
        <b>Q${i + 1}${q.theme ? " · " + q.theme : ""}</b> — Bonne réponse :
        <span class="good">${LETTERS[q.correct]}. ${q.options[q.correct]}</span>
      </div>`).join("") + `</div>`;
  }

  let verdict, vsub;
  if (pct >= 90) { verdict = "Excellent — tu maîtrises."; vsub = "Enchaîne sur un autre thème pour tout balayer."; }
  else if (pct >= 70) { verdict = "Très bien — bonnes bases."; vsub = "Quelques points à consolider, voir le récap ci-dessous."; }
  else if (pct >= 50) { verdict = "Pas mal — ça avance."; vsub = "Reprends tes erreurs, puis refais le QCM."; }
  else { verdict = "Encore du travail."; vsub = "Revois la notion, une question à la fois, puis recommence."; }

  app.innerHTML = `
    <button class="backlink" id="back">← ${state.level.name}</button>
    <div class="card barred pop result">
      <div class="score-ring"><span id="cnt">0</span><small>/${total}</small></div>
      <div class="pct">${pct}% de réussite — ${quiz.title}</div>
      ${isRecord && prev ? `<div class="newbest">★ Nouveau record</div>` : ""}
      <div class="verdict">${verdict}</div>
      <div class="verdict-sub">${vsub}</div>
      ${breakdownHTML}
      ${recapHTML}
      <button class="btn gold" id="again">Recommencer ce QCM</button>
      <div style="height:10px"></div>
      <button class="btn ghost" id="home">Choisir un autre QCM</button>
    </div>`;

  // animation du score
  let c = 0; const step = Math.max(1, Math.round(score / 22));
  const iv = setInterval(() => {
    c += step; if (c >= score) { c = score; clearInterval(iv); }
    const el = document.getElementById("cnt"); if (el) el.textContent = c;
  }, 35);
  // animation des barres
  setTimeout(() => {
    document.querySelectorAll(".brow .track i").forEach(el => el.style.width = el.dataset.w + "%");
  }, 200);

  document.getElementById("back").onclick = renderHome;
  document.getElementById("home").onclick = renderHome;
  document.getElementById("again").onclick = () => startQuiz(state.level, state.quiz);
}

init();
