import { el, loadJSON, shuffle, recordAnswer, recordExam, getProgress, renderChrome } from "./common.js";

const params = new URLSearchParams(location.search);
const mode = ["topic", "weak"].includes(params.get("mode")) ? params.get("mode") : "exam";
const topicId = params.get("topic");

const site = await renderChrome("quiz.html");
const [allQuestions, topics] = await Promise.all([
  loadJSON("content/questions.json"),
  loadJSON("content/topics.json"),
]);

const topic = topics.find((t) => t.id === topicId);
const answered = getProgress().q;
const pool =
  mode === "topic" ? allQuestions.filter((q) => q.topic === topicId)
  : mode === "weak" ? allQuestions.filter((q) => answered[q.id] && !answered[q.id].last)
  : allQuestions;
const questions = shuffle(pool).slice(0, mode === "exam" ? site.exam.questions : pool.length);

const stage = document.getElementById("stage");
const heading = document.getElementById("quiz-title");
heading.textContent =
  mode === "exam" ? "מבחן תרגול" : mode === "weak" ? "חזרה על טעויות" : `תרגול: ${topic?.title ?? ""}`;

let index = 0;
let mistakes = 0;
let deadline = null;
let timerId = null;

if (!questions.length) {
  stage.replaceChildren(
    el("p", {}, mode === "weak" ? "אין כרגע שאלות לחזרה. כל מה שענית עליו נכון בפעם האחרונה." : "אין עדיין שאלות בנושא הזה."),
    el("a", { class: "btn ghost", href: "index.html" }, "לעמוד הראשי"),
  );
} else {
  if (mode === "exam") startTimer(site.exam.minutes * 60);
  showQuestion();
}

function startTimer(seconds) {
  const clock = document.getElementById("clock");
  deadline = Date.now() + seconds * 1000;
  const tick = () => {
    const left = Math.max(0, Math.round((deadline - Date.now()) / 1000));
    clock.textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;
    if (left === 0) finish(true);
  };
  tick();
  timerId = setInterval(tick, 1000);
}

function showQuestion() {
  const q = questions[index];
  const order = shuffle(q.answers.map((text, i) => ({ text, i })));
  const feedback = el("div", { class: "feedback", role: "status", "aria-live": "polite" });
  const next = el("button", { class: "btn", hidden: true, onclick: advance },
    index === questions.length - 1 ? "סיום" : "לשאלה הבאה");

  const buttons = order.map(({ text, i }) =>
    el("button", { class: "answer", onclick: () => choose(i) }, text),
  );

  function choose(chosen) {
    const ok = chosen === q.correct;
    if (!ok) mistakes++;
    recordAnswer(q.id, ok);
    order.forEach(({ i }, n) => {
      buttons[n].disabled = true;
      if (i === q.correct) buttons[n].classList.add("correct");
      else if (i === chosen) buttons[n].classList.add("wrong");
    });
    feedback.replaceChildren(
      el("strong", {}, ok ? "נכון. " : "לא נכון. "),
      q.explanation ?? "",
    );
    feedback.classList.add(ok ? "ok" : "bad");
    next.hidden = false;
    next.focus();
  }

  stage.replaceChildren(...[
    el("p", { class: "progress" }, `שאלה ${index + 1} מתוך ${questions.length}`),
    el("h2", { class: "question" }, q.question),
    q.image && el("img", { class: "q-image", src: q.image, alt: q.imageAlt ?? "" }),
    el("div", { class: "answers" }, buttons),
    feedback,
    next,
  ].filter(Boolean));
}

function advance() {
  if (++index >= questions.length) finish(false);
  else showQuestion();
}

function finish(timedOut) {
  clearInterval(timerId);
  const answered = timedOut ? index : questions.length;
  const unanswered = questions.length - answered;
  const total = mistakes + unanswered;
  const passed = mode === "exam" ? total <= site.exam.maxMistakes : null;
  if (mode === "exam") recordExam({ mistakes: total, passed, date: Date.now() });

  stage.replaceChildren(...[
    el("h2", {}, timedOut ? "הזמן נגמר" : "סיימת"),
    el("p", { class: "score" }, `${questions.length - total} תשובות נכונות מתוך ${questions.length}`),
    passed != null &&
      el("p", { class: passed ? "ok" : "bad" },
        passed ? "עברת את המבחן." : `לא עברת. מותרות עד ${site.exam.maxMistakes} טעויות.`),
    el("a", { class: "btn", href: location.href }, "שוב"),
    el("a", { class: "btn ghost", href: "index.html" }, "לעמוד הראשי"),
  ].filter(Boolean));
}
