const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const out = process.argv[2] || 'frames';
  const times = process.argv[3] ? process.argv[3].split(',').map(Number) : null;
  const fps = 30, dur = 31;
  fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  await p.goto('file://' + __dirname + '/index.html', { waitUntil: 'networkidle' });
  await p.evaluate(() => document.fonts.ready);
  const list = times || Array.from({ length: fps * dur }, (_, i) => i / fps);
  for (let i = 0; i < list.length; i++) {
    await p.evaluate(t => window.__setTime(t), list[i]);
    await p.screenshot({ path: `${out}/f${String(i).padStart(5, '0')}.png` });
  }
  await b.close();
})();
