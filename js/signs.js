import { el, loadJSON, shuffle, renderChrome } from "./common.js";

await renderChrome("signs.html");
const signs = await loadJSON("content/signs.json");
const grid = document.getElementById("signs");
const filters = document.getElementById("filters");
const flipHint = document.getElementById("flip-hint");

let active = "הכל";
let hideMeaning = false;

const categories = ["הכל", ...new Set(signs.map((s) => s.category))];
const filterButtons = categories.map((name) =>
  el("button", { class: "chip", "aria-pressed": name === active, onclick: () => setFilter(name) }, name),
);
filters.append(...filterButtons);

const quizToggle = el("button", {
  class: "chip",
  "aria-pressed": false,
  onclick: (event) => {
    hideMeaning = !hideMeaning;
    event.currentTarget.setAttribute("aria-pressed", hideMeaning);
    flipHint.hidden = !hideMeaning;
    render();
  },
}, "מצב בוחן: הסתר משמעות");
filters.append(quizToggle);

function setFilter(name) {
  active = name;
  filterButtons.forEach((b) => b.setAttribute("aria-pressed", b.textContent === name));
  render();
}

function sign(s) {
  const face = s.image
    ? el("img", { src: s.image, alt: s.name })
    : el("span", { class: `sign sign-${s.shape}`, "aria-hidden": "true" }, el("span", {}, s.symbol));
  const meaning = el("span", { class: "meaning", hidden: hideMeaning }, s.meaning);
  const card = el("button", {
    class: "card sign-card",
    onclick: () => (meaning.hidden = !meaning.hidden),
    "aria-expanded": !hideMeaning,
  }, face, el("span", { class: "name" }, s.name), meaning);
  card.addEventListener("click", () => card.setAttribute("aria-expanded", !meaning.hidden));
  return el("li", {}, card);
}

function render() {
  const shown = signs.filter((s) => active === "הכל" || s.category === active);
  grid.replaceChildren(...(hideMeaning ? shuffle(shown) : shown).map(sign));
}

render();
