import { enginesPresent, hostOf, hostMatches, normalizeDomain, visibilityScore } from "./analyze";
import type { LinkCheck } from "./linkcheck";
import { ENGINES, type Recommendation, type RunResult } from "./types";

const label = (id: string) => ENGINES.find((e) => e.id === id)?.label ?? id;

const ENGINE_TIP: Record<string, string> = {
  openai: "ChatGPT נשען על אינדקס חיפוש ועל אתרים שמצוטטים – ודא ש-OAI-SearchBot לא חסום ושיש לך תוכן ענייני ועדכני על הנושא.",
  perplexity: "Perplexity מצטט מקורות עם תשובה ישירה – כתוב דפים עם תשובה קצרה וברורה בתחילת הדף, עם נתונים ומקורות.",
  gemini: "Gemini נשען על חיפוש Google – חזק SEO ו-E-E-A-T, והוסף Schema.",
  claude: "Claude מחפש ברשת ומצטט דפים עשירים בעובדות – הוסף דפי FAQ והשוואות.",
  google_aio: "ב-AI Overview מופיעים דפים שמדורגים גבוה – חזק דף ייעודי לשאילתה עם כותרות-שאלה ו-FAQ Schema.",
  google_aimode: "ב-AI Mode כדאי לכסות שאלות המשך – בנה אשכול תוכן סביב הנושא.",
};

export function recommend(run: RunResult, link?: LinkCheck | null): Recommendation[] {
  const recs: Recommendation[] = [];
  const ok = run.cells.filter((c) => c.status === "ok");
  if (!ok.length) return [{ priority: "high", title: "אין תוצאות תקינות – בדוק מפתחות API והרץ שוב" }];

  const myScore = visibilityScore(run.cells, "me");
  const myEngines = enginesPresent(run.cells, "me");

  // 1. site-level technical issues
  if (link) {
    const blocked = link.bots.filter((b) => !b.ok).map((b) => b.bot);
    if (blocked.length)
      recs.push({ priority: "high", title: `אפשר גישה לבוטים: ${blocked.join(", ")}`, detail: "הם חסומים ב-robots.txt או ע״י חומת אש – בלי גישה אין סיכוי להצטייין." });
    if (link.noindex) recs.push({ priority: "high", title: "הסר noindex מדף הבית" });
    if (!link.hasSchema) recs.push({ priority: "medium", title: "הוסף Schema (Organization, FAQ, Product)", detail: "עוזר למנועים להבין מי אתה ומה אתה מציע." });
  }

  // 2. competitors ahead of me
  for (const c of run.competitors) {
    const key = normalizeDomain(c.domain);
    const their = visibilityScore(run.cells, key);
    if (their > myScore) {
      recs.push({
        priority: their - myScore >= 20 ? "high" : "medium",
        title: `${c.name} מקדים אותך (${their} מול ${myScore})`,
        detail: `מופיע ב-${enginesPresent(run.cells, key)} מנועים לעומת ${myEngines} שלך. בנה עמוד השוואה "${run.brand} מול ${c.name}" וחזק את הדפים שהוא מצוטט בהם.`,
      });
    }
  }

  // 3. prompts where competitors win and I'm absent
  const byPrompt = new Map<string, typeof ok>();
  ok.forEach((c) => byPrompt.set(c.prompt, [...(byPrompt.get(c.prompt) ?? []), c]));
  for (const [prompt, cells] of byPrompt) {
    const meHit = cells.filter((c) => c.me.mentioned).length;
    const rivals = run.competitors.filter((c) => cells.some((x) => x.competitors[normalizeDomain(c.domain)]?.mentioned));
    if (meHit === 0 && rivals.length) {
      recs.push({
        priority: "high",
        title: `אתה לא מופיע בפרומפט: "${prompt}"`,
        detail: `מופיעים במקומך: ${rivals.map((r) => r.name).join(", ")}. צור דף ייעודי שעונה ישירות על השאלה הזו.`,
      });
    } else if (meHit > 0 && !cells.some((c) => c.me.linked)) {
      recs.push({ priority: "medium", title: `מוזכר אבל בלי לינק: "${prompt}"`, detail: "המנוע מכיר אותך אבל לא מצטט את האתר – הוסף דף עם תשובה ברורה ונתונים שאפשר לצטט." });
    }
  }

  // 4. engines where I'm absent
  for (const id of run.engines) {
    const cells = ok.filter((c) => c.engine === id);
    if (cells.length && !cells.some((c) => c.me.mentioned)) {
      recs.push({ priority: "medium", title: `אין לך נוכחות ב-${label(id)}`, detail: ENGINE_TIP[id] });
    }
  }

  // 5. third-party sources that cite others but not me
  const counts = new Map<string, number>();
  for (const c of ok) for (const u of c.citations) {
    const h = hostOf(u);
    if (!h || hostMatches(u, run.domain) || run.competitors.some((x) => hostMatches(u, x.domain))) continue;
    counts.set(h, (counts.get(h) ?? 0) + 1);
  }
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).filter(([, n]) => n >= 2);
  if (top.length)
    recs.push({ priority: "medium", title: `היכנס למקורות שהמנועים מצטטים: ${top.map(([h]) => h).join(", ")}`, detail: "קבל אזכור, ביקורת או פוסט בשמות האלה – הם מצוטטים שוב ושוב בתשובות." });

  const order = { high: 0, medium: 1, low: 2 } as const;
  return recs.sort((a, b) => order[a.priority] - order[b.priority]).slice(0, 8);
}
