import { el, loadJSON, getProgress, resetProgress, statsFor, readinessLabel, isMastered, renderChrome } from "./common.js";

const site = await renderChrome("index.html");
const [topics, questions, signs] = await Promise.all([
  loadJSON("content/topics.json"),
  loadJSON("content/questions.json"),
  loadJSON("content/signs.json"),
]);

const TOPIC_GOAL = 80; // % mastered before a topic counts as done
document.getElementById("tagline").textContent = site.tagline;

const stat = (value, label) =>
  el("div", { class: "stat" }, el("strong", {}, value), el("span", {}, label));

function nextStep(topicRows, overall) {
  if (!questions.length) return null;
  const open = topicRows.find((r) => r.stats.total && r.stats.masteryPct < TOPIC_GOAL);
  if (!open) return { text: "כל הנושאים מוכנים. הגיע הזמן למבחן מלא.", href: "quiz.html?mode=exam", label: "התחל מבחן" };
  if (open.stats.seen === 0)
    return { text: `הצעד הבא: ${open.topic.title}`, href: `learn.html?topic=${open.topic.id}`, label: "קרא את החומר" };
  return { text: `הצעד הבא: ${open.topic.title}`, href: `quiz.html?mode=topic&topic=${open.topic.id}`, label: "המשך לתרגל" };
}

function render() {
  const progress = getProgress();
  const overall = statsFor(questions, progress);
  const topicRows = topics.map((topic) => ({
    topic,
    stats: statsFor(questions.filter((q) => q.topic === topic.id), progress),
  }));

  document.getElementById("ready-pct").textContent = `${overall.masteryPct}%`;
  document.getElementById("ready-label").textContent = readinessLabel(overall.masteryPct);
  const meter = document.getElementById("ready-meter");
  meter.setAttribute("aria-valuenow", overall.masteryPct);
  meter.firstElementChild.style.width = `${overall.masteryPct}%`;
  document.getElementById("ready-note").textContent =
    `${overall.mastered} מתוך ${overall.total} שאלות נחשבות "שלטת בהן": ענית עליהן נכון לפחות פעמיים, והתשובה האחרונה נכונה.`;

  const step = nextStep(topicRows, overall);
  document.getElementById("next-step").replaceChildren(
    ...(step ? [el("p", {}, step.text), el("a", { class: "btn", href: step.href }, step.label)] : []),
  );

  const lastExam = progress.exams.at(-1);
  document.getElementById("stats").replaceChildren(
    stat(`${overall.seen}/${overall.total}`, "שאלות שנענו"),
    stat(overall.accuracyPct == null ? "—" : `${overall.accuracyPct}%`, "דיוק כולל"),
    stat(lastExam ? `${lastExam.mistakes} טעויות` : "—", "מבחן אחרון"),
  );

  document.getElementById("path").replaceChildren(
    ...topicRows.map(({ topic, stats }, i) => {
      const done = stats.total > 0 && stats.masteryPct >= TOPIC_GOAL;
      return el("li", { class: done ? "step done" : "step" },
        el("div", { class: "step-head" },
          el("span", { class: "step-no", "aria-hidden": "true" }, done ? "✓" : String(i + 1)),
          el("div", {},
            el("h3", {}, topic.title, done && el("span", { class: "badge" }, "הושלם")),
            el("p", {}, topic.summary),
          ),
        ),
        el("div", { class: "meter small", role: "img", "aria-label": `שליטה ${stats.masteryPct}%` },
          el("span", { style: `width:${stats.masteryPct}%` })),
        el("div", { class: "step-foot" },
          el("span", { class: "meta" }, `${stats.mastered}/${stats.total} שאלות בשליטה`),
          el("span", { class: "step-links" },
            el("a", { href: `learn.html?topic=${topic.id}` }, "חומר לימוד"),
            el("a", { href: `quiz.html?mode=topic&topic=${topic.id}` }, "תרגול"),
          ),
        ),
      );
    }),
    el("li", { class: "step final" },
      el("div", { class: "step-head" },
        el("span", { class: "step-no", "aria-hidden": "true" }, String(topicRows.length + 1)),
        el("div", {},
          el("h3", {}, "מבחן מלא"),
          el("p", {}, `${site.exam.questions} שאלות, ${site.exam.minutes} דקות, עד ${site.exam.maxMistakes} טעויות.`),
        ),
      ),
      el("div", { class: "step-foot" }, el("span"),
        el("span", { class: "step-links" }, el("a", { href: "quiz.html?mode=exam" }, "להתחיל מבחן"))),
    ),
  );

  document.getElementById("more").replaceChildren(
    card("quiz.html?mode=weak", "חזרה על טעויות", overall.weak ? `${overall.weak} שאלות שטעית בהן לאחרונה` : "אין כרגע שאלות לחזרה"),
    card("game.html", "משחק", "מרוץ תמרורים ושאלות ב-60 שניות"),
    card("signs.html", "לוח התמרורים", `${signs.filter((s) => isMastered(progress.s[s.number])).length} מתוך ${signs.length} תמרורים בשליטה`),
  );

  const exams = progress.exams.slice(-5).reverse();
  document.getElementById("exams-section").hidden = exams.length === 0;
  document.getElementById("exams").replaceChildren(
    ...exams.map((e) =>
      el("li", { class: e.passed ? "ok" : "bad" },
        new Date(e.date).toLocaleDateString("he-IL"), " · ", `${e.mistakes} טעויות`, " · ", e.passed ? "עברת" : "לא עברת"),
    ),
  );
}

const card = (href, title, text) =>
  el("li", {}, el("a", { class: "card", href }, el("h3", {}, title), el("p", {}, text)));

document.getElementById("reset").addEventListener("click", () => {
  if (confirm("למחוק את כל ההתקדמות מהדפדפן הזה?")) {
    resetProgress();
    render();
  }
});

render();
