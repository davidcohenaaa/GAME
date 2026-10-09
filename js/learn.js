import { el, loadJSON, loadText, renderMarkdown, renderChrome } from "./common.js";

await renderChrome("learn.html");
const topics = await loadJSON("content/topics.json");
const requested = new URLSearchParams(location.search).get("topic");
const current = topics.find((t) => t.id === requested) ?? topics[0];

document.getElementById("topic-nav").append(
  ...topics.map((t) =>
    el("a", { href: `learn.html?topic=${t.id}`, "aria-current": t.id === current.id ? "page" : false }, t.title),
  ),
);

const lesson = document.getElementById("lesson");
try {
  lesson.replaceChildren(
    renderMarkdown(await loadText(`content/topics/${current.id}.md`)),
    el("a", { class: "btn", href: `quiz.html?mode=topic&topic=${current.id}` }, "לתרגול הנושא"),
  );
} catch {
  lesson.textContent = "חומר הלימוד לנושא הזה עדיין לא נכתב.";
}
