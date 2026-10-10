import {
  el, loadJSON, shuffle, signFace, getProgress,
  recordAnswer, recordSign, recordBest, renderChrome,
} from "./common.js";

await renderChrome("game.html");
const [signs, questions] = await Promise.all([
  loadJSON("content/signs.json"),
  loadJSON("content/questions.json"),
]);

const ROUND_SECONDS = 60;
const LIVES = 3;
// Only signs with a short meaning make a readable multiple-choice answer.
const quizSigns = signs.filter((s) => s.meaning.length <= 70);
const MODES = {
  signs: { label: "מה פירוש התמרור?", count: quizSigns.length, min: 4 },
  questions: { label: "שאלות תיאוריה", count: questions.length, min: 1 },
};

const stage = document.getElementById("stage");
let timerId = null;
let pending = null;

function showMenu() {
  clearInterval(timerId);
  clearTimeout(pending);
  const best = getProgress().best;
  stage.replaceChildren(
    el("p", { class: "hint" },
      `יש לך ${LIVES} חיים ו-${ROUND_SECONDS} שניות. כל תשובה נכונה מוסיפה נקודות, ורצף של תשובות נכונות מוסיף בונוס. טעות עולה בחיים.`),
    el("div", { class: "grid" },
      ...Object.entries(MODES).map(([key, mode]) => {
        const ready = mode.count >= mode.min;
        return el("button", { class: "card mode", disabled: !ready, onclick: () => start(key) },
          el("h3", {}, mode.label),
          el("p", {}, ready ? `שיא: ${best[key] ?? 0}` : "אין מספיק תוכן במצב הזה עדיין"),
        );
      }),
    ),
  );
}

function makeItem(mode, source) {
  if (mode === "signs") {
    // Distractors: other meanings, preferably from the same part of the table.
    const meanings = new Set([source.meaning]);
    const pick = (list) => {
      for (const s of shuffle(list)) {
        if (meanings.size >= 4) break;
        meanings.add(s.meaning);
      }
    };
    pick(quizSigns.filter((s) => s.part === source.part));
    pick(quizSigns);
    const options = shuffle([...meanings]);
    return {
      title: "מה פירוש התמרור?",
      visual: el("div", { class: "game-sign" }, signFace(source)),
      options,
      correct: options.indexOf(source.meaning),
      explain: source.meaning,
      record: (ok) => recordSign(source.number, ok),
    };
  }
  const order = shuffle(source.answers.map((text, i) => ({ text, i })));
  return {
    title: source.question,
    visual: null,
    options: order.map((o) => o.text),
    correct: order.findIndex((o) => o.i === source.correct),
    explain: source.explanation,
    record: (ok) => recordAnswer(source.id, ok),
  };
}

function start(mode) {
  const state = { mode, score: 0, streak: 0, lives: LIVES, left: ROUND_SECONDS, locked: false, queue: [], item: null };
  const hud = {
    lives: el("span", {}), score: el("span", {}), time: el("span", { class: "clock" }),
  };
  const body = el("div", {});
  stage.replaceChildren(
    el("div", { class: "hud" },
      el("div", {}, el("small", {}, "חיים"), hud.lives),
      el("div", {}, el("small", {}, "ניקוד"), hud.score),
      el("div", {}, el("small", {}, "זמן"), hud.time),
    ),
    body,
  );

  const paintHud = () => {
    hud.lives.textContent = "●".repeat(state.lives) + "○".repeat(LIVES - state.lives);
    hud.lives.setAttribute("aria-label", `${state.lives} חיים`);
    hud.score.textContent = state.score;
    hud.time.textContent = `${Math.floor(state.left / 60)}:${String(state.left % 60).padStart(2, "0")}`;
  };

  const nextSource = () => {
    if (!state.queue.length) state.queue = shuffle(mode === "signs" ? quizSigns : questions);
    return state.queue.pop();
  };

  function ask() {
    state.locked = false;
    state.item = makeItem(mode, nextSource());
    const { item } = state;
    const feedback = el("div", { class: "feedback", role: "status" });
    const buttons = item.options.map((text, i) =>
      el("button", { class: "answer", onclick: () => choose(i) }, el("span", { class: "key" }, i + 1), text));
    state.buttons = buttons;
    state.feedback = feedback;
    body.replaceChildren(...[
      el("h2", { class: "question" }, item.title),
      item.visual,
      el("div", { class: "answers" }, buttons),
      feedback,
    ].filter(Boolean));
  }

  function choose(i) {
    if (state.locked) return;
    state.locked = true;
    const { item, buttons, feedback } = state;
    const ok = i === item.correct;
    item.record(ok);
    buttons.forEach((b, n) => {
      b.disabled = true;
      if (n === item.correct) b.classList.add("correct");
      else if (n === i) b.classList.add("wrong");
    });
    if (ok) {
      state.streak++;
      state.score += 10 + Math.min(state.streak - 1, 5) * 2;
      feedback.textContent = state.streak > 1 ? `נכון! רצף של ${state.streak}` : "נכון!";
      feedback.className = "feedback ok";
    } else {
      state.streak = 0;
      state.lives--;
      feedback.replaceChildren(el("strong", {}, "לא נכון. "), item.explain ?? "");
      feedback.className = "feedback bad";
    }
    paintHud();
    if (state.lives === 0) return void (pending = setTimeout(finish, 1200));
    pending = setTimeout(ask, ok ? 450 : 1800);
  }

  function finish() {
    clearInterval(timerId);
    clearTimeout(pending);
    document.removeEventListener("keydown", onKey);
    const isBest = recordBest(mode, state.score);
    stage.replaceChildren(
      el("h2", {}, state.lives === 0 ? "נגמרו החיים" : "הזמן נגמר"),
      el("p", { class: "score" }, `${state.score} נקודות`),
      isBest && el("p", { class: "ok" }, "שיא חדש!"),
      el("button", { class: "btn", onclick: () => start(mode) }, "עוד סיבוב"),
      el("button", { class: "btn ghost", onclick: showMenu }, "חזרה לתפריט"),
    );
  }

  function onKey(event) {
    const n = Number(event.key);
    if (n >= 1 && n <= 4 && state.buttons?.[n - 1] && !state.buttons[n - 1].disabled) choose(n - 1);
  }
  document.addEventListener("keydown", onKey);

  clearInterval(timerId);
  timerId = setInterval(() => {
    state.left--;
    paintHud();
    if (state.left <= 0) finish();
  }, 1000);

  paintHud();
  ask();
}

showMenu();
