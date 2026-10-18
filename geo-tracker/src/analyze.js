// Detects which brands an AI answer mentions, where, and in what tone.

const NIQQUD = /[֑-ׇ]/g;
// Hebrew one-letter prefixes that can glue onto a name: ו ה ב ל מ ש כ (up to two, e.g. "ובהראל")
const PREFIX = '(?:[והבלמשכ]{0,2})';
const BOUNDARY_BEFORE = '(?<![\\p{L}\\p{N}])';
const BOUNDARY_AFTER = '(?![\\p{L}\\p{N}])';

const POSITIVE = ['מומלץ', 'מומלצת', 'מוביל', 'מובילה', 'משתלם', 'משתלמת', 'אמין', 'אמינה', 'מצוין', 'מצוינת',
  'טוב', 'טובה', 'זול', 'זולה', 'שירות מעולה', 'יתרון', 'בולט', 'בולטת', 'פופולרי', 'פופולרית', 'נחשבת'];
const NEGATIVE = ['תלונות', 'איטי', 'איטית', 'יקר', 'יקרה', 'בעייתי', 'בעייתית', 'גרוע', 'גרועה', 'חיסרון',
  'חסרון', 'לא מומלץ', 'קריסה', 'פשיטת רגל', 'ביקורת', 'שלילי'];

// Reasons engines give for recommending an insurer. Used to show what is said about rivals but not about the target.
export const ATTRIBUTES = {
  price: { label: 'מחיר נמוך / משתלם', words: ['זול', 'משתלם', 'מחיר נמוך', 'מחירים נמוכים', 'מחיר תחרותי', 'הנחה', 'הנחות', 'חיסכון'] },
  service: { label: 'שירות לקוחות', words: ['שירות', 'מוקד', 'זמינות', 'יחס אישי', 'מענה'] },
  claims: { label: 'טיפול בתביעות', words: ['תביעות', 'תביעה', 'פיצוי', 'יישוב תביעות'] },
  digital: { label: 'דיגיטל / אפליקציה', words: ['אפליקציה', 'אונליין', 'דיגיטלי', 'דיגיטלית', 'באתר', 'אינטרנט', 'מקוון'] },
  garages: { label: 'מוסכי הסדר', words: ['מוסכי הסדר', 'מוסך הסדר', 'מוסכים', 'רשת מוסכים'] },
  towing: { label: 'גרירה ושירותי דרך', words: ['גרירה', 'שירותי דרך', 'רכב חלופי', 'שמשות'] },
  young: { label: 'התאמה לנהג צעיר', words: ['נהג צעיר', 'נהגים צעירים', 'צעירים'] },
  ev: { label: 'רכב חשמלי', words: ['חשמלי', 'סוללה', 'טעינה'] },
  coverage: { label: 'כיסויים רחבים', words: ['כיסוי רחב', 'כיסויים רחבים', 'כיסוי מקיף', 'הרחבות', 'כתבי שירות'] },
  reputation: { label: 'מוניטין / חוסן', words: ['ותיקה', 'גדולה', 'מובילה', 'מוביל', 'יציבה', 'אמינה', 'מוניטין', 'דירוג'] },
  usage: { label: 'ביטוח לפי שימוש', words: ['לפי קילומטר', 'לפי שימוש', 'לפי נסועה', 'ק"מ'] },
};

export function attributesOf(sentence) {
  return Object.entries(ATTRIBUTES).filter(([, a]) => a.words.some((w) => sentence.includes(w))).map(([id]) => id);
}

export function normalize(text) {
  return String(text || '')
    .replace(NIQQUD, '')
    .replace(/[״”“]/g, '"')
    .replace(/[׳’‘]/g, "'")
    .replace(/‏|‎/g, '');
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function aliasPattern(alias) {
  // Hebrew aliases may take a prefix; spaces between words are flexible.
  const body = escapeRe(normalize(alias)).replace(/\s+/g, '\\s+');
  const isHebrew = /[א-ת]/.test(alias);
  return new RegExp(`${BOUNDARY_BEFORE}${isHebrew ? PREFIX : ''}(${body})${BOUNDARY_AFTER}`, 'giu');
}

// Ambiguous words ("כלל" = "rule/all", "מגדל" = "tower") count only in a brand-like context.
const AMBIGUOUS_STOP_PREFIX = /^(?:ב|כ|ו?ב|ו?כ)$/; // "בכלל", "ככלל" = "at all", "as a rule"

function ambiguousIsBrand(text, index, matchText, word, allBrandRegexes) {
  const prefix = matchText.slice(0, matchText.length - word.length);
  const after = text.slice(index + matchText.length, index + matchText.length + 40);
  const nextWord = (after.match(/^\s*([^\s.,:;!?()*"]+)/u) || [])[1] || '';
  // "כלל ה..." / "מגדל ה..." is a construct phrase ("all the ...", "the tower of ..."), not a brand.
  if (/^ה/.test(nextWord) && !/^הביטוח/.test(nextWord)) return false;
  if (/^(ביטוח|לביטוח|חברה|ביטוחים)/.test(nextWord)) return true;
  if (AMBIGUOUS_STOP_PREFIX.test(prefix) && !/ביטוח/.test(nextWord)) return false;

  const lineStart = text.lastIndexOf('\n', index) + 1;
  let lineEnd = text.indexOf('\n', index);
  if (lineEnd === -1) lineEnd = text.length;
  const line = text.slice(lineStart, lineEnd);
  const before = text.slice(Math.max(0, index - 3), index);
  // Bold / heading / list item that starts with the word: "**כלל**", "1. כלל –", "- כלל:"
  if (/\*\*\s*$/.test(before) || /^\s*(?:[-*•]|\d+[.)]|#+)\s*(?:\*\*)?\s*$/.test(text.slice(lineStart, index))) return true;
  // Listed alongside another insurer in the same line ("הפניקס, כלל והראל").
  return allBrandRegexes.some((re) => {
    re.lastIndex = 0;
    return re.test(line);
  });
}

export function compileBrands(brandsConfig) {
  const brands = brandsConfig.brands.map((b) => ({
    ...b,
    strong: (b.aliases || []).map(aliasPattern),
    weak: (b.ambiguous || []).map((w) => ({ word: normalize(w), re: aliasPattern(w) })),
  }));
  for (const b of brands) {
    b.otherRegexes = brands.filter((o) => o.id !== b.id).flatMap((o) => o.strong);
  }
  return brands;
}

function sentenceAround(text, index) {
  const start = Math.max(text.lastIndexOf('.', index), text.lastIndexOf('\n', index), text.lastIndexOf('!', index)) + 1;
  const ends = ['.', '\n', '!', '?'].map((c) => text.indexOf(c, index)).filter((i) => i !== -1);
  const end = ends.length ? Math.min(...ends) : text.length;
  return text.slice(start, end).trim();
}

function clean(sentence) {
  return sentence.replace(/\*\*|__|#+\s*/g, '').replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').trim();
}

export function sentimentOf(sentence) {
  let score = 0;
  for (const w of POSITIVE) if (sentence.includes(w)) score += 1;
  for (const w of NEGATIVE) if (sentence.includes(w)) score -= 1;
  return score > 0 ? 'positive' : score < 0 ? 'negative' : 'neutral';
}

export function findMentions(rawText, compiledBrands) {
  const text = normalize(rawText);
  const results = [];
  for (const b of compiledBrands) {
    const hits = [];
    for (const re of b.strong) {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(text))) hits.push(m.index);
    }
    for (const { word, re } of b.weak) {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(text))) {
        if (ambiguousIsBrand(text, m.index, m[0], word, b.otherRegexes)) hits.push(m.index);
      }
    }
    if (!hits.length) continue;
    const unique = [...new Set(hits)].sort((a, b2) => a - b2);
    const first = unique[0];
    const sentence = clean(sentenceAround(text, first));
    const sentences = [...new Set(unique.map((i) => clean(sentenceAround(text, i))))].slice(0, 4);
    results.push({ brand: b.id, count: unique.length, firstIndex: first, sentiment: sentimentOf(sentence), snippet: sentence.slice(0, 220),
      sentences: sentences.map((x) => x.slice(0, 300)),
      // A complaint is not a reason to recommend, so only non-negative sentences give attributes.
      attributes: attributesOf(sentences.filter((x) => sentimentOf(x) !== 'negative').join(' ')) });
  }
  results.sort((a, b) => a.firstIndex - b.firstIndex);
  results.forEach((r, i) => { r.rank = i + 1; });
  return results;
}

export function domainOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    // Gemini grounding sometimes gives only a title like "fnx.co.il"
    const s = String(url || '').trim().toLowerCase().replace(/^www\./, '');
    return /^[a-z0-9.-]+\.[a-z]{2,}$/.test(s) ? s : null;
  }
}

export function brandForDomain(domain, brandsConfig) {
  if (!domain) return null;
  const b = brandsConfig.brands.find((x) => x.domains.some((d) => domain === d || domain.endsWith('.' + d)));
  return b ? b.id : null;
}

export function analyzeAnswer(answer, compiledBrands, brandsConfig) {
  const mentions = findMentions(answer.text, compiledBrands);
  const citations = (answer.citations || []).map((c) => {
    const domain = domainOf(c.url) || domainOf(c.title);
    return { url: c.url, title: c.title || '', domain, brand: brandForDomain(domain, brandsConfig) };
  });
  return { mentions, citations };
}
