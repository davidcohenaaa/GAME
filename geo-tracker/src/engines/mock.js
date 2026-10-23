// Fake engines for trying the whole pipeline without API keys (MOCK=1).
// Answers use the brands from the active brands file (fictional ones in demo mode).
import { readConfig, brandsConfigName } from '../config.js';

const THIRD_PARTY = ['https://compare-demo.example/car', 'https://news-demo.example/economy/car-insurance',
  'https://forum-demo.example/young-drivers', 'https://consumer-demo.example/insurance'];

const PRAISE = [
  'מומלצת בזכות מחיר משתלם והנחות לנהגים זהירים',
  'בולטת בשירות לקוחות זמין ומוקד 24/7',
  'מציעה רשת רחבה של מוסכי הסדר',
  'נחשבת מובילה בטיפול מהיר בתביעות',
  'מציעה אפליקציה נוחה לניהול הפוליסה אונליין',
  'בעלת מסלול ייעודי לנהג צעיר',
  'כוללת גרירה ורכב חלופי בכתב השירות',
];
const COMPLAINT = 'יש תלונות על זמני טיפול בתביעות';

function rng(seed) {
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return () => ((h = Math.imul(h ^ (h >>> 15), 2246822507) ^ Math.imul(h ^ (h >>> 13), 3266489909)) >>> 0) / 4294967296;
}

export function mockEngines() {
  const cfg = readConfig(brandsConfigName());
  const byId = Object.fromEntries(cfg.brands.map((b) => [b.id, b]));
  const target = byId[cfg.target];
  const main = byId[cfg.mainCompetitor];
  const others = cfg.brands.filter((b) => b !== target && b !== main);
  const bias = { chatgpt: 0.35, gemini: 0.55, claude: 0.45, perplexity: 0.3 };
  return Object.entries(bias).map(([id, targetChance]) => ({
    id,
    label: { chatgpt: 'ChatGPT', gemini: 'Gemini', claude: 'Claude', perplexity: 'Perplexity' }[id] + ' (דמו)',
    model: 'mock',
    async ask(prompt, rep = 0) {
      const r = rng(id + prompt + rep);
      let list = others.filter(() => r() < 0.45);
      if (r() < 0.8) list.unshift(main);
      if (r() < targetChance) list.splice(Math.floor(r() * (list.length + 1)), 0, target);
      list = list.slice(0, 5);
      // The main competitor tends to be credited with service, garages and the app; the target gets fewer reasons.
      const reason = (b) => {
        if (r() < 0.2) return COMPLAINT;
        if (b === main) return PRAISE[1 + Math.floor(r() * 4)];
        if (b === target) return PRAISE[r() < 0.6 ? 0 : 6];
        return PRAISE[Math.floor(r() * PRAISE.length)];
      };
      const lines = list.map((b, i) => `${i + 1}. **${b.name}** – ${reason(b)}.`);
      const text = `בהתייחס לשאלה "${prompt}", ככלל כדאי להשוות כמה הצעות.\n${lines.join('\n')}\nבכלל, המחיר תלוי בגיל הנהג ובוותק.`;
      const own = list.filter(() => r() < 0.3).map((b) => `https://www.${b.domains[0]}/car`);
      const citations = [...own, ...THIRD_PARTY.filter(() => r() < 0.35)].map((url) => ({ url, title: '' }));
      return { text, citations };
    },
  }));
}
