// מדפיס לכל path בעמוד SVG (שנוצר ע"י pdftocairo -svg) את האינדקס, המילוי, הקו ותיבת הגבול בפיקסלים.
// משמש לאיתור סילואטות/לוגואים בספר המותג לפני ייצוא עם pdf_export.js.
// שימוש: NODE_PATH=$(npm root -g) node pdf_paths.js /abs/path/page.svg
const { chromium } = require('playwright');
(async () => {
  const [file] = process.argv.slice(2);
  if (!file) { console.error('usage: pdf_paths.js <page.svg>'); process.exit(1); }
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  await p.goto('file://' + require('path').resolve(file));
  const rows = await p.evaluate(() => [...document.querySelectorAll('path')].map((e, i) => {
    const r = e.getBoundingClientRect(), cs = getComputedStyle(e);
    return { i, fill: cs.fill, stroke: cs.stroke, x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
  }).filter(a => a.w > 3 && a.h > 3 && a.w < 1900));
  for (const a of rows) console.log(`${a.i}\tfill=${a.fill}\tstroke=${a.stroke}\tx=${a.x}\ty=${a.y}\tw=${a.w}\th=${a.h}`);
  await b.close();
})();
