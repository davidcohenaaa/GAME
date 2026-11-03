// מייצא paths נבחרים מעמוד SVG לקובץ SVG עצמאי. המטריצה נאפית לתוך ה-transform,
// והצבע הופך ל-currentColor כדי שאפשר יהיה לצבוע את הנכס ב-CSS (color).
// שימוש: NODE_PATH=$(npm root -g) node pdf_export.js /abs/page.svg 139-149,151 out.svg
const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const [file, idxs, out] = process.argv.slice(2);
  if (!file || !idxs || !out) { console.error('usage: pdf_export.js <page.svg> <indices e.g. 3,5-9> <out.svg>'); process.exit(1); }
  const ids = idxs.split(',').flatMap(r => {
    const [a, b] = r.split('-').map(Number);
    return b ? Array.from({ length: b - a + 1 }, (_, i) => a + i) : [a];
  });
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  await p.goto('file://' + require('path').resolve(file));
  const svg = await p.evaluate(ids => {
    const all = [...document.querySelectorAll('path')];
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    const parts = [];
    ids.forEach(i => {
      const e = all[i], r = e.getBoundingClientRect(), m = e.getScreenCTM(), cs = getComputedStyle(e);
      x0 = Math.min(x0, r.x); y0 = Math.min(y0, r.y); x1 = Math.max(x1, r.right); y1 = Math.max(y1, r.bottom);
      const fill = cs.fill === 'none' ? 'none' : 'currentColor';
      const stroke = cs.stroke === 'none' ? '' : ` stroke="currentColor" stroke-width="${cs.strokeWidth}" stroke-linecap="${cs.strokeLinecap}" stroke-linejoin="${cs.strokeLinejoin}"`;
      parts.push(`<path d="${e.getAttribute('d')}" transform="matrix(${m.a} ${m.b} ${m.c} ${m.d} ${m.e} ${m.f})" fill="${fill}"${stroke} fill-rule="${cs.fillRule}"/>`);
    });
    const pad = 2;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${(x0 - pad).toFixed(1)} ${(y0 - pad).toFixed(1)} ${(x1 - x0 + 2 * pad).toFixed(1)} ${(y1 - y0 + 2 * pad).toFixed(1)}">${parts.join('')}</svg>`;
  }, ids);
  fs.writeFileSync(out, svg);
  console.log(out, svg.length, 'bytes');
  await b.close();
})();
