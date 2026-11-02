// מרנדר עמוד אנימציה פריים-פריים ל-PNG. העמוד חייב לחשוף window.__setTime(t) ו-window.__duration.
// שימוש: NODE_PATH=$(npm root -g) node render.js <page.html[?query]> <out_dir> [t1,t2,...]
//   בלי רשימת זמנים: כל הסרטון ב-FPS (ברירת מחדל 30). עם רשימה: רק פריימי בדיקה.
//   גודל: W/H במשתני סביבה (ברירת מחדל 1080x1920, אנכי 9:16).
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
(async () => {
  const [pageArg, out, times] = process.argv.slice(2);
  if (!pageArg || !out) { console.error('usage: render.js <page.html[?query]> <out_dir> [t1,t2,...]'); process.exit(1); }
  const W = +(process.env.W || 1080), H = +(process.env.H || 1920), fps = +(process.env.FPS || 30);
  const [file, query] = pageArg.split('?');
  const url = 'file://' + path.resolve(file) + (query ? '?' + query : '');
  fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: W, height: H } });
  p.on('pageerror', e => console.error('page error:', e.message));
  p.on('requestfailed', r => console.error('missing file:', r.url()));
  await p.goto(url, { waitUntil: 'networkidle' });
  await p.evaluate(() => document.fonts.ready);
  const dur = await p.evaluate(() => window.__duration);
  if (!dur) { console.error('page has no window.__duration'); process.exit(1); }
  const list = times ? times.split(',').map(Number) : Array.from({ length: Math.round(fps * dur) }, (_, i) => i / fps);
  for (let i = 0; i < list.length; i++) {
    await p.evaluate(t => window.__setTime(t), list[i]);
    await p.screenshot({ path: `${out}/f${String(i).padStart(5, '0')}.png` });
  }
  console.log(`rendered ${list.length} frames (${W}x${H}) to ${out}; duration ${dur}s`);
  await b.close();
})();
