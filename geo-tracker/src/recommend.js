// Turns a run's raw answers into coverage numbers and a prioritized action list.
import { ATTRIBUTES, sentimentOf } from './analyze.js';

const INTENT_WEIGHT = { high: 1.5, medium: 1.0, low: 0.6 };

// What a page answering each topic should contain so engines can quote it.
const TOPIC_TIPS = {
  'מקיף': 'טבלת השוואה של הכיסויים במקיף (שבר שמשות, גרירה, רכב חלופי, מוסכי הסדר), טווחי מחיר לפי סוג רכב, ופסקת פתיחה שעונה "למי המקיף של {T} מתאים".',
  'המלצה כללית': 'עמוד "למה לבחור ב{T} לביטוח רכב" עם נתונים מדידים: מדד שירות של רשות שוק ההון, זמני טיפול בתביעה, דירוגים, מספר מוסכי הסדר ומוקד 24/7.',
  'נהג נוסף': 'עמוד FAQ "כמה עולה להוסיף נהג מזדמן/נוסף" עם טווח מחיר מפורש בשקלים, תהליך בשלבים (אונליין/טלפון), מה צריך (ת"ז, ותק), ותוך כמה זמן הכיסוי נכנס לתוקף.',
  'נהג צעיר': 'מדריך נהג צעיר: הגדרת גיל (עד 24) וותק (פחות משנתיים), טווחי מחיר, דרכים להוזלה (נהג מלווה, השתתפות עצמית, מערכות בטיחות, ביטוח לפי ק"מ) ומסלול ייעודי של {T} אם קיים.',
  'רכב חשמלי': 'עמוד ביטוח לרכב חשמלי: כיסוי לסוללה ולעמדת טעינה, מוסכים מורשים לחשמליים, גרירה לרכב חשמלי, והבדלי מחיר מול רכב בנזין.',
  "צד ג'": "עמוד צד ג' עם רשימת כיסויים מפורשת (נזק לרכוש, כיסויי הרחבה), התאמה לרכבי פנאי/שטח/אופנועים, וטבלת חובה מול צד ג' מול מקיף.",
  'ביטוח לפי שימוש': 'עמוד ביטוח לפי קילומטר/שימוש: איך נמדד, למי משתלם (מתחת ל-X ק"מ בשנה), דוגמת חישוב במספרים, ואם אין מוצר כזה — הסבר מה החלופה בכלל.',
  'גרירה ושירותים': 'עמוד כתבי שירות: מה כלול בגרירה (מרחק, זמן הגעה, רכב חלופי), מה כלול במקיף כברירת מחדל ומה בתוספת, ומחיר משוער לרכב חדש.',
  'מחיר ורכישה': 'מדריך "איך להוזיל ביטוח רכב חדש" עם צעדים פרקטיים, מחשבון/סימולטור, והסבר על השוואת מחירים באתר הממשלתי — כש{T} מוצגת כאפשרות עם יתרונות ברורים.',
  'מוסכי הסדר': 'עמוד מוסכי הסדר: מספר המוסכים ופריסה, חיסכון בהשתתפות עצמית במספרים, אחריות על התיקון, ואיתור מוסך לפי עיר.',
};

const ENGINE_TIPS = {
  gemini: 'Gemini נשען על חיפוש גוגל: ודאו שהעמוד מאונדקס, עם Schema (FAQPage, Organization, InsuranceAgency), כותרות שתואמות את השאלה, ופרופיל Google Business מעודכן.',
  chatgpt: 'ChatGPT מחפש ברשת ומעדיף מקורות עצמאיים: ודאו שהעמודים מאונדקסים ב-Bing (Bing Webmaster Tools), ונוכחות באתרי השוואה וכתבות צרכנות.',
  claude: 'Claude מחפש ברשת ומצטט עמודים עם תשובה ישירה וברורה בפסקה הראשונה, נתונים מספריים ומקורות סמכותיים.',
  perplexity: 'Perplexity מעדיף תוכן עדכני וקל לציטוט: תאריך עדכון גלוי, רשימות ממוספרות, טבלאות, ונוכחות במקורות שהוא כבר מצטט לשאלה הזו.',
  grok: 'Grok עונה בעיקר מהידע של המודל ומ-X: נוכחות עקבית בתקשורת, ויקיפדיה, ופעילות ברשתות לאורך זמן.',
  deepseek: 'DeepSeek עונה מהידע של המודל (ללא חיפוש): ערך ויקיפדיה מדויק, כתבות ותיקות ואזכורים רבים ברשת לאורך זמן משפיעים על התשובה.',
};

const pct = (n, d) => (d ? n / d : 0);

function validAnswers(run) {
  return run.answers.filter((a) => !a.error);
}

function mentionOf(answer, brandId) {
  return answer.mentions.find((m) => m.brand === brandId);
}

function cellStats(answers, target, rivals) {
  const n = answers.length;
  const t = answers.map((a) => mentionOf(a, target)).filter(Boolean);
  const rivalRates = rivals.map((id) => ({ id, rate: pct(answers.filter((a) => mentionOf(a, id)).length, n) }))
    .sort((a, b) => b.rate - a.rate);
  const firstRate = pct(t.filter((m) => m.rank === 1).length, n);
  const negative = t.filter((m) => m.sentiment === 'negative').length;
  return {
    n,
    rate: pct(t.length, n),
    firstRate,
    avgRank: t.length ? t.reduce((s, m) => s + m.rank, 0) / t.length : null,
    negativeShare: pct(negative, t.length),
    topRival: rivalRates[0] || { id: null, rate: 0 },
  };
}

// Which reasons do engines give for each brand? Compare the target with a rival.
export function attributeGap(answers, target, rival) {
  const count = (id) => {
    const c = {};
    let n = 0;
    for (const a of answers) {
      const m = mentionOf(a, id);
      if (!m) continue;
      n++;
      for (const at of m.attributes || []) c[at] = (c[at] || 0) + 1;
    }
    return { c, n };
  };
  const t = count(target);
  const r = count(rival);
  return Object.keys(ATTRIBUTES).map((id) => ({
    id, label: ATTRIBUTES[id].label,
    rival: pct(r.c[id] || 0, r.n), target: pct(t.c[id] || 0, t.n),
    rivalCount: r.c[id] || 0, targetCount: t.c[id] || 0,
  })).filter((x) => x.rivalCount > 0 || x.targetCount > 0)
    .sort((a, b) => (b.rival - b.target) - (a.rival - a.target));
}

function statusOf(cell, mainRate) {
  if (!cell.n) return 'nodata';
  if (cell.rate === 0) return mainRate > 0 ? 'missing' : 'absent';
  if (cell.firstRate >= 0.5) return 'lead';
  if (cell.rate >= 0.5) return 'present';
  return 'weak';
}

export function buildReport(run) {
  const { target, mainCompetitor } = run.brands;
  const brandIds = run.brands.brands.map((b) => b.id);
  const rivals = brandIds.filter((id) => id !== target);
  const answers = validAnswers(run);
  const engines = run.engines.map((e) => e.id);

  // Share of voice
  const sov = run.brands.brands.map((b) => {
    const perEngine = {};
    for (const e of engines) {
      const ea = answers.filter((a) => a.engine === e);
      perEngine[e] = pct(ea.filter((a) => mentionOf(a, b.id)).length, ea.length);
    }
    const mentioned = answers.filter((a) => mentionOf(a, b.id));
    return {
      brand: b.id, name: b.name,
      rate: pct(mentioned.length, answers.length),
      firstRate: pct(mentioned.filter((a) => mentionOf(a, b.id).rank === 1).length, answers.length),
      perEngine,
    };
  }).sort((a, b) => b.rate - a.rate);

  // Prompt x engine matrix
  const rows = run.prompts.map((p) => {
    const pa = answers.filter((a) => a.promptId === p.id);
    const cells = {};
    for (const e of engines) {
      const ca = pa.filter((a) => a.engine === e);
      const cell = cellStats(ca, target, rivals);
      const mainRate = pct(ca.filter((a) => mentionOf(a, mainCompetitor)).length, ca.length);
      cells[e] = { ...cell, mainRate, status: statusOf(cell, Math.max(mainRate, cell.topRival.rate)) };
    }
    const all = cellStats(pa, target, rivals);
    const mainRate = pct(pa.filter((a) => mentionOf(a, mainCompetitor)).length, pa.length);
    return {
      prompt: p, cells,
      rate: all.rate, firstRate: all.firstRate, mainRate,
      gapVsMain: mainRate - all.rate,
      gapVsBest: all.topRival.rate - all.rate,
      topRival: all.topRival,
    };
  });

  // Sources: which domains feed answers, and do those answers include the target?
  const sourceMap = new Map();
  for (const a of answers) {
    const hasTarget = !!mentionOf(a, target);
    const hasMain = !!mentionOf(a, mainCompetitor);
    const seen = new Set();
    for (const c of a.citations) {
      if (!c.domain || seen.has(c.domain)) continue;
      seen.add(c.domain);
      const s = sourceMap.get(c.domain) || { domain: c.domain, brand: c.brand, answers: 0, withTarget: 0, withMainNoTarget: 0, prompts: new Set(), engines: new Set(), urls: new Set() };
      s.answers++;
      if (hasTarget) s.withTarget++;
      if (hasMain && !hasTarget) s.withMainNoTarget++;
      s.prompts.add(a.promptId);
      s.engines.add(a.engine);
      if (s.urls.size < 5) s.urls.add(c.url);
      sourceMap.set(c.domain, s);
    }
  }
  const sources = [...sourceMap.values()]
    .map((s) => ({ ...s, prompts: [...s.prompts], engines: [...s.engines], urls: [...s.urls], kind: s.brand === target ? 'own' : s.brand ? 'competitor' : 'third-party' }))
    .sort((a, b) => b.withMainNoTarget - a.withMainNoTarget || b.answers - a.answers);

  const recommendations = buildRecommendations({ run, rows, answers, engines, target, mainCompetitor });

  const targetSov = sov.find((s) => s.brand === target) || { rate: 0, firstRate: 0, perEngine: {} };
  const mainSov = sov.find((s) => s.brand === mainCompetitor) || { rate: 0, firstRate: 0, perEngine: {} };
  const cellsAll = rows.flatMap((r) => Object.values(r.cells)).filter((c) => c.n);
  return {
    runId: run.id, startedAt: run.startedAt, status: run.status, total: run.total, done: run.done, errors: run.errors,
    engines: run.engines, target, mainCompetitor,
    brandNames: Object.fromEntries(run.brands.brands.map((b) => [b.id, b.name])),
    kpi: {
      targetRate: targetSov.rate, mainRate: mainSov.rate,
      targetFirst: targetSov.firstRate, mainFirst: mainSov.firstRate,
      coveredCells: cellsAll.filter((c) => c.rate >= 0.5).length,
      totalCells: cellsAll.length,
      gapPrompts: rows.filter((r) => r.gapVsMain > 0).length,
    },
    attributeGap: attributeGap(answers, target, mainCompetitor),
    sov, rows: rows.sort((a, b) => b.gapVsMain - a.gapVsMain || a.rate - b.rate), sources, recommendations,
  };
}

function buildRecommendations({ run, rows, answers, engines, target, mainCompetitor }) {
  const names = Object.fromEntries(run.brands.brands.map((b) => [b.id, b.name]));
  const engineLabel = Object.fromEntries(run.engines.map((e) => [e.id, e.label]));
  const T = names[target];
  const out = [];

  for (const r of rows) {
    const missingEngines = engines.filter((e) => r.cells[e]?.n && r.cells[e].rate < 0.5);
    if (!missingEngines.length && r.gapVsMain <= 0 && r.firstRate >= 0.5) continue;

    const pa = answers.filter((a) => a.promptId === r.prompt.id);
    const withoutTarget = pa.filter((a) => !mentionOf(a, target));
    const ownCited = pa.some((a) => a.citations.some((c) => c.brand === target));
    const tally = (list) => {
      const m = new Map();
      for (const c of list) m.set(c.key, { ...c, n: (m.get(c.key)?.n || 0) + 1 });
      return [...m.values()].sort((a, b) => b.n - a.n);
    };
    const thirdParty = tally(withoutTarget.flatMap((a) => a.citations.filter((c) => !c.brand && c.domain).map((c) => ({ key: c.domain, domain: c.domain }))));
    const rivalPages = tally(withoutTarget.flatMap((a) => a.citations.filter((c) => c.brand && c.brand !== target).map((c) => ({ key: c.url, url: c.url, brand: c.brand }))));

    const actions = [];
    const rivalId = r.mainRate >= r.topRival.rate ? mainCompetitor : r.topRival.id;
    const attrGap = rivalId ? attributeGap(pa, target, rivalId) : [];
    const missingClaims = attrGap.filter((x) => x.rivalCount >= 1 && x.rival - x.target >= 0.25);
    if (missingClaims.length) {
      // Quote the actual sentences where an engine credits the rival with a reason the target lacks.
      const words = missingClaims.flatMap((x) => ATTRIBUTES[x.id].words);
      const quotes = [...new Set(pa.map((a) => mentionOf(a, rivalId)).filter(Boolean)
        .flatMap((m) => m.sentences || [m.snippet]).filter((sn) => words.some((w) => sn.includes(w)) && sentimentOf(sn) !== 'negative'))].slice(0, 3);
      actions.push({ type: 'claims-gap', title: `מה אומרים על ${names[rivalId]} ולא אומרים עלייך`,
        detail: `המנועים מנמקים את ההמלצה על ${names[rivalId]} ב: ${missingClaims.map((x) => `${x.label} (${Math.round(x.rival * 100)}% מול ${Math.round(x.target * 100)}% אצל ${T})`).join(', ')}. צריך שיהיו מקורות (באתר של ${T} ובאתרים חיצוניים) שמבססים את היתרונות האלה אצל ${T} עם נתונים.`,
        quotes });
    }
    const tip = (TOPIC_TIPS[r.prompt.topic] || '').replaceAll('{T}', T);
    if (!ownCited) {
      actions.push({ type: 'content', title: 'צרו עמוד שעונה בדיוק על השאלה',
        detail: `אף מנוע לא ציטט את האתר של ${T} בשאלה הזו. ${tip || 'עמוד ייעודי עם תשובה ישירה בפסקה הראשונה, מספרים מפורשים ו-FAQ.'} נסחו את הכותרת כמו השאלה: "${r.prompt.text}".` });
    } else {
      actions.push({ type: 'content', title: 'חזקו את העמוד הקיים',
        detail: `האתר של ${T} מצוטט לפעמים, אבל לא מספיק. ${tip} הוסיפו תאריך עדכון, טבלה ו-Schema מסוג FAQPage.` });
    }
    if (thirdParty.length) {
      actions.push({ type: 'third-party', title: 'השיגו נוכחות במקורות שהמנועים מצטטים',
        detail: `בתשובות שבהן ${T} חסרה, המנועים נשענו על: ${thirdParty.slice(0, 4).map((t) => `${t.domain} (${t.n})`).join(', ')}. פנו לאתרים האלה (כתבה, עדכון השוואה, תוכן ממומן מסומן, תגובה מומחית) כדי ש${T} תופיע שם.`,
        domains: thirdParty.slice(0, 6).map((t) => t.domain) });
    }
    if (rivalPages.length) {
      actions.push({ type: 'competitor-page', title: 'למדו מעמודי המתחרים שמצוטטים',
        detail: `עמודים של מתחרים שהמנועים ציטטו כאן: ${rivalPages.slice(0, 3).map((p) => `${names[p.brand]} – ${p.url}`).join(' | ')}. בדקו מה יש בהם (מחירים מפורשים, טבלאות, תשובה בראש העמוד) ובנו עמוד מקיף יותר.`,
        urls: rivalPages.slice(0, 5).map((p) => p.url) });
    }
    const present = pa.map((a) => mentionOf(a, target)).filter(Boolean);
    if (present.length && r.firstRate < 0.5) {
      const neg = present.filter((m) => m.sentiment === 'negative').length;
      actions.push({ type: 'positioning', title: 'מוזכרת — אבל לא ראשונה',
        detail: `${T} מוזכרת ב-${Math.round(r.rate * 100)}% מהתשובות אבל ראשונה רק ב-${Math.round(r.firstRate * 100)}%. הדגישו יתרון ייחודי ומדיד לנושא "${r.prompt.topic}" בכל העמודים והמקורות החיצוניים.${neg ? ` ב-${neg} אזכורים ההקשר שלילי — בדקו את הציטוטים ותנו מענה (ביקורות, נתוני שירות עדכניים).` : ''}` });
    }
    for (const e of missingEngines) {
      if (ENGINE_TIPS[e] && missingEngines.length < engines.length) {
        actions.push({ type: 'engine', title: `חסרה ב-${engineLabel[e]}`, detail: ENGINE_TIPS[e] });
      }
    }

    const gap = Math.max(r.gapVsMain, r.gapVsBest, 0) + (1 - r.rate) * 0.5 + (1 - r.firstRate) * 0.25;
    const score = Math.round(Math.min(100, gap * (missingEngines.length / Math.max(1, engines.length) + 0.3) * (INTENT_WEIGHT[r.prompt.intent] || 1) * 60));
    out.push({
      promptId: r.prompt.id, prompt: r.prompt.text, topic: r.prompt.topic, intent: r.prompt.intent,
      score, rate: r.rate, mainRate: r.mainRate, mainName: names[mainCompetitor],
      topRival: r.topRival.id ? { name: names[r.topRival.id], rate: r.topRival.rate } : null,
      missingEngines: missingEngines.map((e) => engineLabel[e]),
      rival: rivalId ? names[rivalId] : null,
      attributeGap: attrGap,
      ownUrls: [...new Set(pa.flatMap((a) => a.citations.filter((c) => c.brand === target).map((c) => c.url)))].slice(0, 3),
      rivalUrls: rivalPages.slice(0, 5).map((p) => p.url),
      actions,
    });
  }
  return out.sort((a, b) => b.score - a.score);
}

// Optional: ask Claude to turn the numbers into a written action plan.
export async function aiPlan(report, env, claudeMessage) {
  const summary = {
    target: report.brandNames[report.target], mainCompetitor: report.brandNames[report.mainCompetitor],
    kpi: report.kpi,
    shareOfVoice: report.sov.slice(0, 8).map((s) => ({ name: s.name, rate: +s.rate.toFixed(2), first: +s.firstRate.toFixed(2) })),
    gaps: report.recommendations.slice(0, 12).map((r) => ({ prompt: r.prompt, topic: r.topic, targetRate: +r.rate.toFixed(2), mainRate: +r.mainRate.toFixed(2), missingIn: r.missingEngines, sourcesWithoutTarget: r.actions.find((a) => a.domains)?.domains || [] })),
    reasonsGivenForMainCompetitorVsTarget: report.attributeGap.map((a) => ({ reason: a.label, rival: +a.rival.toFixed(2), target: +a.target.toFixed(2) })),
    topSources: report.sources.slice(0, 15).map((s) => ({ domain: s.domain, kind: s.kind, cited: s.answers, citedWhenRivalButNotTarget: s.withMainNoTarget })),
  };
  const data = await claudeMessage(env, {
    model: env.ANTHROPIC_MODEL || 'claude-opus-5-5',
    max_tokens: 16000,
    output_config: { effort: 'high' },
    system: 'You are a GEO (generative engine optimization) strategist for the Israeli insurance market. Write in Hebrew. Be concrete: name pages to build, sites to approach, and what each page must contain. Base every point on the data given; do not invent statistics.',
    messages: [{ role: 'user', content: `הנה נתוני מעקב הנוכחות של ${summary.target} בתשובות מנועי בינה מול המתחרים. כתוב תוכנית פעולה ל-90 יום להגעה לכיסוי מלא: קודם 5 הפעולות עם ההשפעה הגדולה ביותר, אחר כך לפי נושא, ובסוף מה למדוד בהרצה הבאה. השתמש בכותרות ורשימות Markdown.\n\n${JSON.stringify(summary)}` }],
  });
  if (data.stop_reason === 'refusal') throw new Error('Claude declined the request');
  return (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
}
