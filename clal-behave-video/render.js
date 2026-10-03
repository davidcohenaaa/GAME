// שימוש: node render.js <out_dir> [times,comma,separated]  (PAGE=kinetic.html W=1080 H=1920)
const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const page = process.env.PAGE || 'index.html';
  const W = +(process.env.W || 1920), H = +(process.env.H || 1080), fps = 30;
  const out = process.argv[2] || 'frames';
  fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: W, height: H } });
  await p.goto('file://' + __dirname + '/' + page, { waitUntil: 'networkidle' });
  await p.evaluate(() => document.fonts.ready);
  const dur = await p.evaluate(() => window.__duration || 31);
  const list = process.argv[3] ? process.argv[3].split(',').map(Number) : Array.from({ length: Math.round(fps * dur) }, (_, i) => i / fps);
  for (let i = 0; i < list.length; i++) {
    await p.evaluate(t => window.__setTime(t), list[i]);
    await p.screenshot({ path: `${out}/f${String(i).padStart(5, '0')}.png` });
  }
  await b.close();
})();
