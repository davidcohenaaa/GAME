// Fetches a page and measures the things AI engines tend to quote: direct answers, numbers, tables, FAQ markup, freshness.
import { normalize } from './analyze.js';

const UA = 'Mozilla/5.0 (compatible; GEO-Tracker/1.0; +page-audit)';

function strip(html) {
  return html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
}

function keywordsOf(question) {
  return normalize(question).replace(/[?.,!"']/g, ' ').split(/\s+/)
    .map((w) => w.replace(/^[והבלמשכ](?=[א-ת]{3,})/, ''))
    .filter((w) => w.length >= 3 && !['איזה', 'איזו', 'כמה', 'האם', 'מהו', 'מהם', 'איך', 'כיצד', 'עבור', 'לגבי', 'שלי', 'הכי'].includes(w));
}

export function auditHtml(html, question = '') {
  const title = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || '';
  const h1 = strip((html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || [])[1] || '');
  const text = normalize(strip(html));
  const words = text.split(/\s+/).length;
  const jsonLd = [...html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]).join(' ');
  const schemaTypes = [...new Set([...jsonLd.matchAll(/"@type"\s*:\s*"([^"]+)"/g)].map((m) => m[1]))];
  const kw = keywordsOf(question);
  const firstPara = text.slice(0, 1500);
  const prices = text.match(/(?:₪\s?\d[\d,]*|\d[\d,]*\s?(?:₪|ש"ח|שקלים|שקל))/g) || [];
  return {
    title: strip(title), h1, words,
    signals: {
      priceNumbers: prices.length,
      tables: (html.match(/<table/gi) || []).length,
      lists: (html.match(/<(?:ul|ol)[\s>]/gi) || []).length,
      faqSchema: schemaTypes.includes('FAQPage'),
      schemaTypes,
      questionHeadings: (html.match(/<h[2-4][^>]*>[^<]*\?/gi) || []).length,
      updatedDate: /(?:עודכן|עדכון אחרון|תאריך עדכון|dateModified)/.test(text + jsonLd),
      keywordCoverage: kw.length ? kw.filter((w) => text.includes(w)).length / kw.length : 0,
      keywordsInHeading: kw.length ? kw.filter((w) => (h1 + ' ' + title).includes(w)).length / kw.length : 0,
      answerUpFront: kw.length ? kw.filter((w) => firstPara.includes(w)).length / kw.length : 0,
    },
  };
}

// Only public web pages: the URLs come from AI citations, so never fetch local or private addresses.
function isPublicUrl(url) {
  try {
    const u = new URL(url);
    if (!/^https?:$/.test(u.protocol)) return false;
    const h = u.hostname;
    return !(h === 'localhost' || h.endsWith('.local') || h.endsWith('.internal') || /^\[|^(?:\d+\.){3}\d+$/.test(h));
  } catch {
    return false;
  }
}

export async function auditUrl(url, question) {
  if (!isPublicUrl(url)) return { url, error: 'כתובת לא נתמכת' };
  try {
    const res = await fetch(url, { headers: { 'user-agent': UA, 'accept-language': 'he-IL,he;q=0.9' }, redirect: 'follow', signal: AbortSignal.timeout(20000) });
    if (!res.ok) return { url, error: `HTTP ${res.status}` };
    return { url, ...auditHtml(await res.text(), question) };
  } catch (err) {
    return { url, error: String(err.message || err) };
  }
}

const CHECKS = [
  ['priceNumbers', (v) => v > 0, 'מחירים מפורשים בשקלים', (r) => `${r} סכומים`],
  ['tables', (v) => v > 0, 'טבלת השוואה / מחירים', (r) => `${r} טבלאות`],
  ['faqSchema', (v) => v, 'Schema מסוג FAQPage', () => 'יש'],
  ['questionHeadings', (v) => v >= 2, 'כותרות בניסוח של שאלות', (r) => `${r} כותרות`],
  ['updatedDate', (v) => v, 'תאריך עדכון גלוי', () => 'יש'],
  ['answerUpFront', (v) => v >= 0.6, 'תשובה ישירה בתחילת העמוד', (r) => `${Math.round(r * 100)}% ממילות השאלה`],
  ['keywordsInHeading', (v) => v >= 0.5, 'השאלה מופיעה בכותרת', (r) => `${Math.round(r * 100)}% ממילות השאלה`],
  ['lists', (v) => v >= 2, 'רשימות / שלבים', (r) => `${r} רשימות`],
];

// Compare the target page with rival pages: list what rivals have that the target lacks.
export function comparePages(own, rivals) {
  const ok = rivals.filter((r) => !r.error);
  const missing = [];
  for (const [key, pass, label, fmt] of CHECKS) {
    const rivalsWith = ok.filter((r) => pass(r.signals[key]));
    const ownHas = own && !own.error ? pass(own.signals[key]) : false;
    if (rivalsWith.length && !ownHas) {
      missing.push({ key, label, rivalsWith: rivalsWith.length, of: ok.length, example: `${rivalsWith[0].url} — ${fmt(rivalsWith[0].signals[key])}` });
    }
  }
  const avgWords = ok.length ? Math.round(ok.reduce((s, r) => s + r.words, 0) / ok.length) : 0;
  if (own && !own.error && avgWords && own.words < avgWords * 0.6) {
    missing.push({ key: 'words', label: 'עומק תוכן', rivalsWith: ok.length, of: ok.length, example: `אצלך ${own.words} מילים, אצל המתחרים ${avgWords} בממוצע` });
  }
  return { missing, avgRivalWords: avgWords };
}
