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

import type { PageContent, PageUnderstanding } from "./types";

/** Deterministic fake pages: competitors rich, "me" thin; "#rendered" simulates JS-built content. */
export function mockPageHtml(url: string): string {
  const u = new URL(url.replace("#rendered", ""));
  const rendered = url.includes("#rendered");
  const rich = !/acme/i.test(u.hostname);
  const faq = rich ? Array.from({ length: 6 }, (_, i) => `<h3>איך ${["מתחילים", "מחשבים מחיר", "מחברים", "מבטלים", "מייצאים", "מתאימים"][i]}?</h3><p>תשובה ברורה ומפורטת מספר ${i + 1}.</p>`).join("") : "";
  const table = rich ? "<table><tr><th>תכונה</th><th>אנחנו</th></tr><tr><td>מחיר</td><td>49 ₪</td></tr></table>" : "";
  const para = (rich ? "טקסט מקיף על הנושא עם נתונים ודוגמאות. " : "טקסט קצר. ").repeat(rich ? 60 : 8);
  const ld = rich ? `<script type="application/ld+json">{"@type":["Article","FAQPage"],"dateModified":"2026-09-01"}</script>` : "";
  const shell = `<html><head><title>${u.hostname} – מדריך מלא</title><meta name="description" content="תיאור"></head><body><div id="root"></div><script src="a.js"></script><script src="b.js"></script><script src="c.js"></script></body></html>`;
  if (!rich && !rendered && /\/app/.test(u.pathname)) return shell;
  return `<html><head><title>${u.hostname} – מדריך מלא</title><meta name="description" content="תיאור הדף">${ld}</head><body><nav>תפריט</nav><h1>${rich ? "המדריך המלא לניהול פרויקטים" : "ברוכים הבאים"}</h1><h2>למי זה מתאים</h2><p>${para}</p>${table}${faq}<footer>זכויות</footer></body></html>`;
}

export function mockUnderstanding(c: PageContent): PageUnderstanding {
  return {
    source: "ai",
    summary: `הדף "${c.title}" מציג ${c.wordCount > 300 ? "הסבר מקיף" : "תוכן שיווקי קצר"} על נושא הדף.`,
    audience: "בעלי עסקים קטנים",
    mainEntity: c.headings.find((h) => h.level === 1)?.text ?? c.title,
    questionsAnswered: c.headings.filter((h) => h.level >= 2).slice(0, 5).map((h) => h.text),
    unclear: c.wordCount > 300 ? [] : ["לא ברור מה בדיוק המוצר מציע", "אין מחיר או נתונים להשוואה"],
    clarityScore: c.wordCount > 300 ? 82 : 41,
  };
}

import type { LinkCheck } from "./linkcheck";

export function mockLinkCheck(url: string): LinkCheck {
  const u = /^[a-z]+:\/\//i.test(url) ? url : "https://" + url;
  const bots = [
    ["GPTBot", "ChatGPT (אימון)", false], ["OAI-SearchBot", "ChatGPT Search", true], ["ClaudeBot", "Claude", true],
    ["PerplexityBot", "Perplexity", true], ["Google-Extended", "Gemini (אימון)", true], ["Googlebot", "Google Search / AI Overview", true],
  ] as const;
  return {
    url: u, finalUrl: u, status: 200, noindex: false, hasSchema: false, hasRobotsTxt: true, hasSitemap: false,
    bots: bots.map(([bot, label, ok]) => ({ bot, label, robots: ok ? "allowed" : "blocked", fetchStatus: null, ok })),
    issues: ["robots.txt חוסם את GPTBot", "אין נתוני Schema (JSON-LD) – קשה יותר למנועים להבין את הדף", "לא הוגדר sitemap ב-robots.txt"],
  };
}
