import { hostMatches, normalizeDomain } from "./analyze";
import { fence, llmJson, SAFETY_RULES } from "./llm";
import { extractContent, pageType } from "./pagecontent";
import { defaultFetchHtml } from "./readpage";
import { isDemo } from "./store";
import { mockPageHtml } from "./mock";
import type { AnalysisResult, Gap, PageContent, PageProfile, RunResult, Settings } from "./types";

const PAGES_PER_SITE = 3;

export interface Target { url: string; cited: number }

/** Most-cited URLs of a domain across the whole run. */
export function topCitedUrls(run: RunResult, domain: string, limit = PAGES_PER_SITE): Target[] {
  const counts = new Map<string, number>();
  for (const c of run.cells) for (const k of new Set(c.citations.filter((u) => hostMatches(u, domain)).map((u) => u.split("#")[0]))) {
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([url, cited]) => ({ url, cited }));
}

/** Prompts where I lose: not linked while at least one competitor is mentioned (worst first). */
export function losingPrompts(run: RunResult, max = 6): { prompt: string; winners: string[] }[] {
  const out: { prompt: string; winners: string[]; gap: number }[] = [];
  for (const prompt of run.prompts) {
    const cells = run.cells.filter((c) => c.prompt === prompt && c.status === "ok");
    if (!cells.length) continue;
    const mine = cells.filter((c) => c.me.linked).length * 1 + cells.filter((c) => c.me.mentioned && !c.me.linked).length * 0.6;
    const winners = run.competitors.filter((comp) => {
      const k = normalizeDomain(comp.domain);
      return cells.some((c) => c.competitors[k]?.mentioned);
    });
    if (!winners.length) continue;
    const theirBest = Math.max(...winners.map((w) => {
      const k = normalizeDomain(w.domain);
      return cells.reduce((a, c) => a + (c.competitors[k]?.linked ? 1 : c.competitors[k]?.mentioned ? 0.6 : 0), 0);
    }));
    if (theirBest > mine) out.push({ prompt, winners: winners.map((w) => w.name), gap: theirBest - mine });
  }
  return out.sort((a, b) => b.gap - a.gap).slice(0, max).map(({ prompt, winners }) => ({ prompt, winners }));
}

export function profileOf(url: string, c: PageContent, cited: number): PageProfile {
  return {
    url, title: c.title, type: pageType(c, url), words: c.wordCount,
    h2s: c.headings.filter((h) => h.level === 2).map((h) => h.text).slice(0, 12),
    faq: c.faqCount, tables: c.tableCount, lists: c.listCount, hasNumbers: c.hasNumbers,
    schemaTypes: c.schemaTypes, dateModified: c.dateModified, cited,
  };
}

type Fetch = (url: string) => Promise<{ html: string; status: number; finalUrl: string }>;

async function readProfiles(targets: Target[], fetchHtml: Fetch): Promise<{ profiles: PageProfile[]; contents: PageContent[] }> {
  const profiles: PageProfile[] = [];
  const contents: PageContent[] = [];
  for (const t of targets) {
    try {
      const { html, status, finalUrl } = await fetchHtml(t.url);
      const c = extractContent(html, finalUrl);
      if (status >= 400) throw new Error(`HTTP ${status}`);
      profiles.push(profileOf(finalUrl, c, t.cited));
      contents.push(c);
    } catch (e) {
      profiles.push({ url: t.url, title: "", type: "other", words: 0, h2s: [], faq: 0, tables: 0, lists: 0, hasNumbers: false, schemaTypes: [], cited: t.cited, error: e instanceof Error ? e.message : String(e) });
    }
  }
  return { profiles, contents };
}

const best = <T,>(a: T[], f: (x: T) => number) => a.reduce<T | null>((m, x) => (!m || f(x) > f(m) ? x : m), null);

/** Gap list built only from measurable facts (used when no LLM key is available). */
export function factGaps(
  prompts: { prompt: string; winners: string[] }[],
  comps: AnalysisResult["competitors"],
  me: PageProfile[],
): Gap[] {
  const mine = me.filter((p) => !p.error);
  const myBest = best(mine, (p) => p.words);
  return prompts.map(({ prompt, winners }) => {
    const theirs = comps.filter((c) => winners.includes(c.name)).flatMap((c) => c.pages.filter((p) => !p.error).map((p) => ({ ...p, owner: c.name })));
    const top = best(theirs, (p) => p.cited);
    const theyDo: string[] = [];
    const weMiss: string[] = [];
    if (top) {
      theyDo.push(`${top.owner}: "${top.title || top.url}" (${top.type}, ${top.words} מילים, צוטט ${top.cited} פעמים) – ${top.url}`);
      if (top.faq) theyDo.push(`יש בו ${top.faq} שאלות/תשובות`);
      if (top.tables) theyDo.push(`יש בו ${top.tables} טבלאות`);
      if (top.schemaTypes.length) theyDo.push(`Schema: ${top.schemaTypes.join(", ")}`);
      if (top.dateModified) theyDo.push(`עודכן: ${top.dateModified}`);
      if (!myBest) weMiss.push("לא נמצא אף דף שלך שמצוטט או נגיש");
      else {
        if (myBest.words < top.words * 0.6) weMiss.push(`הדף שלך קצר יותר (${myBest.words} מול ${top.words} מילים)`);
        if (top.faq > myBest.faq) weMiss.push(`אצלך ${myBest.faq} שאלות/תשובות מול ${top.faq}`);
        if (top.tables > myBest.tables) weMiss.push("אין לך טבלת השוואה/נתונים");
        if (top.schemaTypes.some((t) => !myBest.schemaTypes.includes(t))) weMiss.push(`חסר Schema: ${top.schemaTypes.filter((t) => !myBest.schemaTypes.includes(t)).join(", ")}`);
      }
    }
    return {
      prompt, winners, theyDo, weMiss,
      plan: {
        pageTitle: `דף ייעודי שעונה על: ${prompt}`,
        outline: top?.h2s.length ? top.h2s : [],
        faq: [], data: [], external: [],
      },
      impact: "high" as const, effort: "medium" as const,
    };
  });
}

function compact(p: PageProfile) {
  return { url: p.url, type: p.type, words: p.words, h2: p.h2s, faq: p.faq, tables: p.tables, schema: p.schemaTypes, updated: p.dateModified, cited: p.cited };
}

export interface AnalysisDeps { fetchHtml?: Fetch }

export async function analyzeCompetitors(s: Settings, run: RunResult, deps: AnalysisDeps = {}): Promise<AnalysisResult> {
  const demo = isDemo(s);
  const fetchHtml: Fetch = deps.fetchHtml ?? (demo ? async (u) => ({ html: mockPageHtml(u), status: 200, finalUrl: u }) : defaultFetchHtml);
  const warnings: string[] = [];

  const competitors: AnalysisResult["competitors"] = [];
  const compContents = new Map<string, PageContent[]>();
  for (const c of run.competitors) {
    let targets = topCitedUrls(run, c.domain);
    if (!targets.length) { targets = [{ url: `https://${normalizeDomain(c.domain)}`, cited: 0 }]; warnings.push(`${c.name}: אף דף שלו לא צוטט – נקרא דף הבית בלבד`); }
    const { profiles, contents } = await readProfiles(targets, fetchHtml);
    competitors.push({ name: c.name, domain: c.domain, pages: profiles });
    compContents.set(c.name, contents);
  }

  let myTargets = topCitedUrls(run, run.domain);
  if (!myTargets.length) { myTargets = [{ url: `https://${normalizeDomain(run.domain)}`, cited: 0 }]; warnings.push("אף דף שלך לא צוטט – נקרא דף הבית בלבד"); }
  const { profiles: me, contents: myContents } = await readProfiles(myTargets, fetchHtml);

  const losing = losingPrompts(run);
  const pagesRead = competitors.reduce((a, c) => a + c.pages.length, 0) + me.length;
  let gaps: Gap[] = [];
  let mode: AnalysisResult["mode"] = "facts";

  if (losing.length) {
    const facts = factGaps(losing, competitors, me);
    let ai: Gap[] | null = null;
    try {
      const winnerName = (g: { winners: string[] }) => g.winners;
      const topCompContent = losing.map((l) => {
        const comp = competitors.find((c) => winnerName(l).includes(c.name));
        const idx = comp ? comp.pages.findIndex((p) => !p.error) : -1;
        return comp && idx >= 0 ? { owner: comp.name, url: comp.pages[idx].url, text: compContents.get(comp.name)?.[idx]?.text ?? "" } : null;
      });
      const resp = await llmJson<{ gaps?: Partial<Gap>[] }>(s, {
        system:
          `אתה מומחה GEO (אופטימיזציה למנועי AI). קיבלת: פרומפטים שבהם האתר שלי מפסיד, פרופיל מבני של הדפים שמצוטטים של המתחרים ושלי, וקטעי טקסט מהדפים המנצחים. ` +
          `לכל פרומפט כתוב ניתוח ספציפי ומבוסס עובדות מהדפים (לא עצות כלליות כמו "הוסף Schema" בלי הקשר). ${SAFETY_RULES}\n` +
          `החזר JSON: {"gaps":[{"prompt":string,"winners":string[],"theyDo":string[] (מה המתחרה עושה בדף, כולל URL ועובדות),` +
          `"weMiss":string[] (מה חסר אצלנו ביחס אליהם, ספציפי),"plan":{"pageTitle":string,"outline":string[] (כותרות H2 מוצעות לדף),` +
          `"faq":string[] (שאלות FAQ לכתיבה),"data":string[] (נתונים/טבלאות/דוגמאות להוסיף),"external":string[] (מקורות חיצוניים לקבל בהם אזכור)},` +
          `"impact":"high|medium|low","effort":"high|medium|low"}]}`,
        user:
          `המותג שלי: ${run.brand} (${run.domain})\n` +
          `פרומפטים מפסידים:\n${JSON.stringify(losing)}\n\n` +
          `דפי מתחרים (פרופיל):\n${JSON.stringify(competitors.map((c) => ({ name: c.name, pages: c.pages.filter((p) => !p.error).map(compact) })))}\n\n` +
          `הדפים שלי (פרופיל):\n${JSON.stringify(me.filter((p) => !p.error).map(compact))}\n\n` +
          topCompContent.filter(Boolean).map((t) => fence(`${t!.owner} ${t!.url}`, t!.text, 5000)).join("\n") + "\n\n" +
          myContents.slice(0, 1).map((c) => fence(`mine ${run.domain}`, c.text, 5000)).join("\n"),
        maxTokens: 6000,
        mock: () => ({ gaps: facts.map((g) => ({ ...g, plan: {
          pageTitle: `${run.brand} מול ${g.winners[0] ?? "המתחרים"}: ${g.prompt}`,
          outline: ["תשובה קצרה בראש הדף", "השוואה בטבלה", "למי זה מתאים", "מחירים", "שאלות נפוצות"],
          faq: ["איך בוחרים?", "כמה זה עולה?", "מה ההבדל העיקרי?"],
          data: ["טבלת השוואה עם מחירים", "נתון/מחקר מצוטט עם מקור"],
          external: ["g2.com", "reddit.com"],
        } })) }),
      });
      if (resp?.gaps?.length) {
        ai = resp.gaps.map((g, i): Gap => ({
          prompt: String(g.prompt ?? losing[i]?.prompt ?? ""),
          winners: g.winners?.map(String) ?? losing[i]?.winners ?? [],
          theyDo: (g.theyDo ?? []).map(String),
          weMiss: (g.weMiss ?? []).map(String),
          plan: {
            pageTitle: String(g.plan?.pageTitle ?? ""),
            outline: (g.plan?.outline ?? []).map(String),
            faq: (g.plan?.faq ?? []).map(String),
            data: (g.plan?.data ?? []).map(String),
            external: (g.plan?.external ?? []).map(String),
          },
          impact: (["high", "medium", "low"] as const).includes(g.impact as never) ? (g.impact as Gap["impact"]) : "medium",
          effort: (["high", "medium", "low"] as const).includes(g.effort as never) ? (g.effort as Gap["effort"]) : "medium",
        }));
      }
    } catch (e) {
      warnings.push(`ניתוח ה-AI נכשל (${e instanceof Error ? e.message : e}) – מוצגת השוואת עובדות`);
    }
    if (ai) { gaps = ai; mode = "ai"; } else { gaps = facts; if (!warnings.some((w) => w.startsWith("ניתוח ה-AI"))) warnings.push("אין מפתח API לניתוח (Claude/OpenAI/Gemini) – מוצגת השוואת עובדות בלבד"); }
  }

  return { generatedAt: new Date().toISOString(), mode, pagesRead, competitors, me, gaps, warnings };
}
