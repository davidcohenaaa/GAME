import type { Cell, Competitor, EngineAnswer, Presence, RunResult } from "./types";

/** "https://www.Acme.com/x" | "acme.com" -> "acme.com" */
export function normalizeDomain(input: string): string {
  let s = input.trim().toLowerCase();
  if (!s) return "";
  s = s.replace(/^[a-z]+:\/\//, "").split(/[/?#]/)[0].split(":")[0];
  return s.replace(/^www\./, "");
}

export function hostOf(url: string): string {
  try {
    return normalizeDomain(new URL(url).hostname);
  } catch {
    return normalizeDomain(url);
  }
}

export function hostMatches(url: string, domain: string): boolean {
  const d = normalizeDomain(domain);
  if (!d) return false;
  const h = hostOf(url);
  return h === d || h.endsWith("." + d);
}

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function mentionsName(text: string, name: string): boolean {
  const n = name.trim();
  if (!n) return false;
  if (/^[\x00-\x7F]+$/.test(n)) {
    return new RegExp(`(?<![\\p{L}\\p{N}])${escapeRe(n)}(?![\\p{L}\\p{N}])`, "iu").test(text);
  }
  return text.toLowerCase().includes(n.toLowerCase());
}

export function detectPresence(
  answer: EngineAnswer,
  name: string,
  domain: string,
): Presence {
  const idx = answer.citations.findIndex((u) => hostMatches(u, domain));
  const linked = idx >= 0 || answer.text.toLowerCase().includes(normalizeDomain(domain) || "\0");
  const mentioned = mentionsName(answer.text, name) || linked;
  return { mentioned, linked, rank: idx >= 0 ? idx + 1 : undefined };
}

export function buildCell(
  engine: Cell["engine"],
  prompt: string,
  answer: EngineAnswer,
  me: { brand: string; domain: string },
  competitors: Competitor[],
): Cell {
  const comp: Record<string, Presence> = {};
  for (const c of competitors) {
    comp[normalizeDomain(c.domain)] = detectPresence(answer, c.name, c.domain);
  }
  return {
    engine,
    prompt,
    status: "ok",
    citations: answer.citations,
    me: detectPresence(answer, me.brand, me.domain),
    competitors: comp,
  };
}

export const presenceValue = (p: Presence) => (p.linked ? 1 : p.mentioned ? 0.6 : 0);

/** 0-100 */
export function visibilityScore(cells: Cell[], who: "me" | string): number {
  const ok = cells.filter((c) => c.status === "ok");
  if (!ok.length) return 0;
  const sum = ok.reduce((a, c) => {
    const p = who === "me" ? c.me : c.competitors[who];
    return a + (p ? presenceValue(p) : 0);
  }, 0);
  return Math.round((sum / ok.length) * 100);
}

export function enginesPresent(cells: Cell[], who: "me" | string): number {
  const set = new Set<string>();
  for (const c of cells) {
    if (c.status !== "ok") continue;
    const p = who === "me" ? c.me : c.competitors[who];
    if (p?.mentioned) set.add(c.engine);
  }
  return set.size;
}

export function scoreboard(run: RunResult) {
  return [
    { key: "me", name: run.brand || run.domain, score: visibilityScore(run.cells, "me"), isMe: true },
    ...run.competitors.map((c) => {
      const key = normalizeDomain(c.domain);
      return { key, name: c.name, score: visibilityScore(run.cells, key), isMe: false };
    }),
  ];
}
