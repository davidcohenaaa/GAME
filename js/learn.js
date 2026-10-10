import { el, loadJSON, loadText, getProgress, recordLesson, renderChrome } from "./common.js";

await renderChrome("learn.html");
const topics = await loadJSON("content/topics.json");
const requested = new URLSearchParams(location.search).get("topic");
const current = topics.find((t) => t.id === requested) ?? topics[0];
const lessons = getProgress().lessons;

document.getElementById("topic-nav").append(
  ...topics.map((t) =>
    el("a", { href: `learn.html?topic=${t.id}`, "aria-current": t.id === current.id ? "page" : false },
      lessons[t.id]?.read ? `✓ ${t.title}` : t.title),
  ),
);

const lesson = document.getElementById("lesson");
const checkHref = `quiz.html?mode=check&topic=${current.id}`;

// A lesson file is an HTML fragment; every <h3> starts a new step.
async function loadSteps() {
  const template = document.createElement("template");
  template.innerHTML = await loadText(`content/topics/${current.id}.html`);
  const steps = [];
  let step = null;
  for (const node of template.content.childNodes) {
    if (node.nodeName === "H3" || !step) steps.push((step = { title: node.textContent || current.title, nodes: [] }));
    step.nodes.push(node);
  }
  return steps.filter((s) => s.nodes.some((n) => n.textContent.trim()));
}

let steps;
try {
  steps = await loadSteps();
} catch {
  lesson.textContent = "חומר הלימוד לנושא הזה עדיין לא נכתב.";
}

if (steps) {
  let index = 0;
  let showAll = false;

  const render = () => {
    const last = index === steps.length - 1;
    const body = (showAll ? steps : [steps[index]]).flatMap((s) => s.nodes.map((n) => n.cloneNode(true)));
    lesson.replaceChildren(
      el("p", { class: "kicker" }, current.title),
      showAll
        ? el("p", { class: "meta" }, "כל הפרק ברצף")
        : el("div", { class: "pips", role: "img", "aria-label": `שלב ${index + 1} מתוך ${steps.length}` },
            steps.map((_, i) => el("span", { class: i < index ? "pip done" : i === index ? "pip cur" : "pip" }))),
      ...body,
      el("div", { class: "lesson-nav" },
        showAll
          ? el("a", { class: "btn", href: checkHref, onclick: finish }, "סיימתי, לבדיקת הבנה")
          : [
              index > 0 && el("button", { class: "btn ghost", type: "button", onclick: () => go(index - 1) }, "הקודם"),
              last
                ? el("a", { class: "btn", href: checkHref, onclick: finish }, "סיימתי, לבדיקת הבנה")
                : el("button", { class: "btn", type: "button", onclick: () => go(index + 1) }, "הבא"),
            ],
        el("button", { class: "link", type: "button", onclick: () => { showAll = !showAll; render(); } },
          showAll ? "חזרה לשלבים" : "הצג את כל הפרק ברצף"),
      ),
    );
  };
  const go = (i) => {
    index = i;
    render();
    lesson.scrollIntoView({ block: "start" });
  };
  const finish = () => recordLesson(current.id, { read: true });
  render();
}
