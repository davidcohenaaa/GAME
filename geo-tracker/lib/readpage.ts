import { assertPublicUrl } from "./ssrf";
import { BOTS, safeFetch } from "./linkcheck";
import { llmJson, SAFETY_RULES, fence } from "./llm";
import { contentFromText, extractContent, looksLikeSpa } from "./pagecontent";
import { getKey, isDemo } from "./store";
import { mockPageHtml, mockUnderstanding } from "./mock";
import type { PageContent, PageRead, PageUnderstanding, Settings } from "./types";

export interface ReadDeps {
  /** returns html + status; defaults to a bot-UA SSRF-safe fetch */
  fetchHtml?: (url: string) => Promise<{ html: string; status: number; finalUrl: string }>;
  render?: (url: string) => Promise<PageContent | null>;
}

const BOT_UA = BOTS[0].ua;

export async function defaultFetchHtml(url: string) {
  const { res, finalUrl } = await safeFetch(url, BOT_UA, { check: assertPublicUrl });
  return { html: (await res.text()).slice(0, 800_000), status: res.status, finalUrl };
}

/** JS rendering through Apify's website-content-crawler (headless browser). */
export async function apifyRender(url: string, token: string): Promise<PageContent | null> {
  await assertPublicUrl(url);
  const r = await fetch(
    `https://api.apify.com/v2/acts/apify~website-content-crawler/run-sync-get-dataset-items?token=${encodeURIComponent(token)}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ startUrls: [{ url }], maxCrawlDepth: 0, maxCrawlPages: 1, crawlerType: "playwright:firefox" }),
      signal: AbortSignal.timeout(180000),
    },
  );
  if (!r.ok) throw new Error(`apify ${r.status}`);
  const items = await r.json();
  const it = Array.isArray(items) ? items[0] : null;
  const text: string = it?.markdown ?? it?.text ?? "";
  return text ? contentFromText(text, it?.metadata?.title ?? "") : null;
}

export function heuristicUnderstanding(c: PageContent): PageUnderstanding {
  const h1 = c.headings.find((h) => h.level === 1)?.text;
  const unclear: string[] = [];
  let score = 40;
  if (c.wordCount >= 300) score += 20; else unclear.push(`מעט מאוד טקסט (${c.wordCount} מילים)`);
  if (h1) score += 15; else unclear.push("אין כותרת H1");
  if (c.headings.filter((h) => h.level === 2).length >= 2) score += 10; else unclear.push("מבנה כותרות חלש (פחות מ-2 כותרות H2)");
  if (c.description) score += 10; else unclear.push("אין meta description");
  if (c.schemaTypes.length) score += 5;
  return {
    source: "heuristic",
    summary: c.description || h1 || c.title || "(לא נמצא תיאור)",
    audience: "לא נבדק (נדרש מפתח API של Claude / OpenAI / Gemini)",
    mainEntity: h1 || c.title || "",
    questionsAnswered: c.headings.filter((h) => h.level >= 2).slice(0, 6).map((h) => h.text),
    unclear,
    clarityScore: Math.min(100, score),
  };
}

export async function understandPage(s: Settings, c: PageContent, url: string): Promise<PageUnderstanding> {
  const fallback = heuristicUnderstanding(c);
  if (c.wordCount < 5) return { ...fallback, clarityScore: 0, unclear: ["לא התקבל טקסט מהדף"] };
  if (!isDemo(s) && !(getKey(s, "anthropic") || getKey(s, "openai") || getKey(s, "gemini"))) return fallback;
  try {
    const out = await llmJson<Partial<PageUnderstanding>>(s, {
      system:
        `אתה מנוע AI שקורא דף ומנסה להבין אותו כמו שמנוע חיפוש גנרטיבי היה עושה. ${SAFETY_RULES}\n` +
        `החזר אובייקט JSON עם המפתחות: summary (עד 2 משפטים: על מה הדף), audience, mainEntity (מה/מי הדף עוסק), ` +
        `questionsAnswered (מערך שאלות שהדף עונה עליהן בפועל), unclear (מערך דברים לא ברורים/חסרים/סותרים בדף), ` +
        `clarityScore (0-100: עד כמה קל להבין את הדף ולצטט ממנו).`,
      user: `כותרת: ${c.title}\nכותרות:\n${c.headings.map((h) => `${"#".repeat(h.level)} ${h.text}`).join("\n")}\n\n${fence(url, c.text)}`,
      mock: () => mockUnderstanding(c),
    });
    if (!out || typeof out.summary !== "string") return fallback;
    return {
      source: "ai",
      summary: out.summary,
      audience: out.audience ?? "",
      mainEntity: out.mainEntity ?? "",
      questionsAnswered: Array.isArray(out.questionsAnswered) ? out.questionsAnswered.slice(0, 10).map(String) : [],
      unclear: Array.isArray(out.unclear) ? out.unclear.slice(0, 10).map(String) : [],
      clarityScore: Math.max(0, Math.min(100, Number(out.clarityScore) || 0)),
    };
  } catch {
    return fallback;
  }
}

/** Visit the URL as an AI bot would, read all its text and check it is understandable. */
export async function readPage(s: Settings, rawUrl: string, deps: ReadDeps = {}): Promise<PageRead> {
  const url = /^[a-z]+:\/\//i.test(rawUrl) ? rawUrl : "https://" + rawUrl;
  const demo = isDemo(s);
  const fetchHtml = deps.fetchHtml ?? (demo ? async (u: string) => ({ html: mockPageHtml(u), status: 200, finalUrl: u }) : defaultFetchHtml);
  const notes: string[] = [];

  const { html, status, finalUrl } = await fetchHtml(url);
  const raw = extractContent(html, finalUrl);
  const spa = looksLikeSpa(html, raw);
  if (status >= 400) notes.push(`האתר החזיר ${status} לבוט – הבוט לא מקבל את הדף`);

  let rendered: PageContent | undefined;
  let renderer: PageRead["renderer"] = "none";
  const token = getKey(s, "apify");
  const needRender = spa || raw.wordCount < 300;
  if (needRender) {
    try {
      const r = deps.render ? await deps.render(finalUrl) : demo ? contentFromText(mockPageHtml(finalUrl + "#rendered").replace(/<[^>]+>/g, " ")) : token ? await apifyRender(finalUrl, token) : null;
      if (r) { rendered = r; renderer = "apify"; }
    } catch (e) {
      notes.push(`רינדור JS נכשל: ${e instanceof Error ? e.message : e}`);
    }
    if (!rendered) notes.push(spa ? "הדף נראה כמו אפליקציית JS ולא ניתן היה לרנדר אותו (נדרש מפתח Apify) – ייתכן שבוטים רואים אותו ריק" : "לא ניתן היה לרנדר JS כדי לוודא שלא חסר תוכן");
  }

  let visibleRatio: number | undefined;
  if (rendered && rendered.wordCount > 0) {
    visibleRatio = Math.min(1, raw.wordCount / rendered.wordCount);
    if (visibleRatio < 0.6) notes.push(`בוטים שלא מריצים JS רואים רק ${Math.round(visibleRatio * 100)}% מהטקסט בדף (${raw.wordCount} מתוך ${rendered.wordCount} מילים)`);
  } else if (raw.wordCount === 0) {
    notes.push("הבוט לא קיבל שום טקסט מהדף");
  }

  // understanding is based on what a bot can actually see (raw), unless raw is poor and rendering found more
  const basis = rendered && rendered.wordCount > raw.wordCount * 1.5 ? rendered : raw;
  const understanding = await understandPage(s, basis, finalUrl);
  if (basis === rendered) notes.push("ההבנה נבדקה על הגרסה המרונדרת; הבוט הרגיל לא רואה אותה");

  return { url: finalUrl, status, raw, rendered, renderer, spaSuspected: spa, visibleRatio, understanding, notes };
}
