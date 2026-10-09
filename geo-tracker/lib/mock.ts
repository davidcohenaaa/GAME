import type { EngineAnswer, Settings } from "./types";

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

const THIRD = ["reddit.com", "wikipedia.org", "g2.com", "medium.com"];

/** Deterministic fake answers so the UI can be tried without API keys. */
export function mockAnswer(engine: string, prompt: string, s: Settings): EngineAnswer {
  const h = hash(engine + "|" + prompt);
  const cites: string[] = [];
  const names: string[] = [];
  const everyone = [{ name: s.brand, domain: s.domain, w: 3 }, ...s.competitors.map((c) => ({ ...c, w: 5 }))];
  everyone.forEach((p, i) => {
    if (!p.domain) return;
    const r = (h >>> (i * 3)) % 10;
    if (r < p.w) {
      names.push(p.name);
      if (r < p.w - 2) cites.push(`https://www.${p.domain}/${encodeURIComponent(prompt.slice(0, 12))}`);
    }
  });
  cites.push(`https://${THIRD[h % THIRD.length]}/thread/${h % 1000}`);
  const text = names.length
    ? `בהתאם לחיפוש, הכלים הבולטים הם: ${names.join(", ")}.`
    : "יש כמה אפשרויות בשוק, ההמלצה תלויה בצרכים שלך.";
  return { text, citations: cites };
}
