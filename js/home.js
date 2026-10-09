import { el, loadJSON, getProgress, resetProgress, renderChrome } from "./common.js";

const site = await renderChrome("index.html");
const [topics, questions] = await Promise.all([
  loadJSON("content/topics.json"),
  loadJSON("content/questions.json"),
]);

document.getElementById("tagline").textContent = site.tagline;

function renderProgress() {
  const { answered, exams } = getProgress();
  const known = questions.filter((q) => q.id in answered);
  const correct = known.filter((q) => answered[q.id]).length;
  const lastExam = exams.at(-1);

  const stats = document.getElementById("stats");
  stats.replaceChildren(
    stat(`${known.length}/${questions.length}`, "שאלות שנענו"),
    stat(known.length ? `${Math.round((correct / known.length) * 100)}%` : "—", "אחוז הצלחה"),
    stat(lastExam ? `${lastExam.mistakes} טעויות` : "—", "מבחן אחרון"),
  );
}

const stat = (value, label) =>
  el("div", { class: "stat" }, el("strong", {}, value), el("span", {}, label));

const topicList = document.getElementById("topics");
for (const topic of topics) {
  const count = questions.filter((q) => q.topic === topic.id).length;
  topicList.append(
    el(
      "li",
      {},
      el("a", { class: "card", href: `quiz.html?mode=topic&topic=${topic.id}` },
        el("h3", {}, topic.title),
        el("p", {}, topic.summary),
        el("span", { class: "meta" }, `${count} שאלות`),
      ),
    ),
  );
}

document.getElementById("reset").addEventListener("click", () => {
  if (confirm("למחוק את כל ההתקדמות מהדפדפן הזה?")) {
    resetProgress();
    renderProgress();
  }
});

renderProgress();
