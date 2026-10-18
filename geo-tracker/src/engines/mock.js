// Fake engines for trying the whole pipeline without API keys (MOCK=1).
const SITES = ['https://www.fnx.co.il/car', 'https://www.harel-group.co.il/insurance/car', 'https://www.clalbit.co.il/car',
  'https://www.ynet.co.il/economy/article/car-insurance', 'https://www.bituachnet.co.il/compare', 'https://www.555.co.il/car',
  'https://www.themarker.com/consumer/insurance', 'https://www.zap.co.il/insurance', 'https://www.migdal.co.il/car'];
const NAMES = ['הפניקס', 'הראל', 'כלל ביטוח', 'מגדל', 'ביטוח ישיר', 'מנורה מבטחים', 'איילון', 'AIG', '9 מיליון', 'ליברה'];

function rng(seed) {
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return () => ((h = Math.imul(h ^ (h >>> 15), 2246822507) ^ Math.imul(h ^ (h >>> 13), 3266489909)) >>> 0) / 4294967296;
}

export function mockEngines() {
  const bias = { chatgpt: 0.35, gemini: 0.55, claude: 0.45, perplexity: 0.3 };
  return Object.entries(bias).map(([id, clalChance]) => ({
    id,
    label: { chatgpt: 'ChatGPT', gemini: 'Gemini', claude: 'Claude', perplexity: 'Perplexity' }[id] + ' (דמו)',
    model: 'mock',
    async ask(prompt, rep = 0) {
      const r = rng(id + prompt + rep);
      let names = NAMES.filter((n) => n !== 'כלל ביטוח' && r() < 0.5);
      if (!names.includes('הפניקס') && r() < 0.7) names.unshift('הפניקס');
      if (r() < clalChance) names.splice(Math.floor(r() * (names.length + 1)), 0, 'כלל ביטוח');
      names = names.slice(0, 5);
      const lines = names.map((n, i) => `${i + 1}. **${n}** – ${r() < 0.7 ? 'מומלצת בזכות שירות טוב ומחיר משתלם' : 'יש תלונות על זמני טיפול בתביעות'}.`);
      const text = `בהתייחס לשאלה "${prompt}", ככלל כדאי להשוות כמה הצעות.\n${lines.join('\n')}\nבכלל, המחיר תלוי בגיל הנהג ובוותק.`;
      const citations = SITES.filter(() => r() < 0.35).map((url) => ({ url, title: '' }));
      return { text, citations };
    },
  }));
}
