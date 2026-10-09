// Shared helpers: DOM builder, content loading, progress storage, page chrome.

export function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (key === "class") node.className = value;
    else if (key.startsWith("on")) node.addEventListener(key.slice(2), value);
    else if (value !== false && value != null) node.setAttribute(key, value);
  }
  for (const child of children.flat()) {
    if (child == null || child === false) continue;
    node.append(child.nodeType ? child : document.createTextNode(child));
  }
  return node;
}

async function fetchOk(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  return res;
}

export const loadJSON = async (path) => (await fetchOk(path)).json();
export const loadText = async (path) => (await fetchOk(path)).text();

export function shuffle(list) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// Progress is a per-browser convenience; the site works if storage is blocked.
const KEY = "theory-progress-v1";
const empty = () => ({ answered: {}, exams: [] });

export function getProgress() {
  try {
    return { ...empty(), ...JSON.parse(localStorage.getItem(KEY)) };
  } catch {
    return empty();
  }
}

function saveProgress(progress) {
  try {
    localStorage.setItem(KEY, JSON.stringify(progress));
  } catch {
    /* storage unavailable */
  }
}

export function recordAnswer(questionId, isCorrect) {
  const progress = getProgress();
  progress.answered[questionId] = isCorrect;
  saveProgress(progress);
}

export function recordExam(result) {
  const progress = getProgress();
  progress.exams = [...progress.exams.slice(-9), result];
  saveProgress(progress);
}

export function resetProgress() {
  saveProgress(empty());
}

const NAV = [
  ["index.html", "ראשי"],
  ["learn.html", "חומר לימוד"],
  ["signs.html", "תמרורים"],
  ["quiz.html?mode=exam", "מבחן"],
];

export async function renderChrome(active) {
  const site = await loadJSON("content/site.json");
  document.title = `${document.title} | ${site.name}`;
  const header = el(
    "header",
    { class: "site-header" },
    el(
      "div",
      { class: "wrap bar" },
      el("a", { class: "brand", href: "index.html" }, site.name),
      el(
        "nav",
        { "aria-label": "ראשי" },
        NAV.map(([href, label]) =>
          el("a", { href, "aria-current": href.startsWith(active) ? "page" : false }, label),
        ),
      ),
    ),
  );
  const footer = el("footer", { class: "site-footer" }, el("div", { class: "wrap" }, site.footer));
  document.body.prepend(header);
  document.body.append(footer);
  return site;
}

// Minimal markdown: headings, bullet lists, quotes, **bold**, paragraphs.
export function renderMarkdown(source) {
  const root = document.createDocumentFragment();
  let list = null;
  const inline = (text) =>
    text
      .split(/(\*\*[^*]+\*\*)/)
      .map((part) =>
        part.startsWith("**") ? el("strong", {}, part.slice(2, -2)) : part,
      );

  for (const raw of source.split("\n")) {
    const line = raw.trim();
    if (line.startsWith("- ")) {
      if (!list) root.append((list = el("ul")));
      list.append(el("li", {}, inline(line.slice(2))));
      continue;
    }
    list = null;
    if (!line) continue;
    if (line.startsWith("## ")) root.append(el("h3", {}, line.slice(3)));
    else if (line.startsWith("# ")) root.append(el("h2", {}, line.slice(2)));
    else if (line.startsWith("> ")) root.append(el("blockquote", {}, inline(line.slice(2))));
    else root.append(el("p", {}, inline(line)));
  }
  return root;
}
