import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { compileBrands, analyzeAnswer } from '../src/analyze.js';
import { buildReport } from '../src/recommend.js';
import { auditHtml, comparePages } from '../src/pageAudit.js';

const cfg = JSON.parse(fs.readFileSync(new URL('../config/brands.json', import.meta.url)));
const brands = compileBrands(cfg);

function answer(promptId, engine, text, citations = []) {
  const ans = { text, citations };
  return { promptId, engine, rep: 0, text, ...analyzeAnswer(ans, brands, cfg) };
}

const run = {
  id: 't', startedAt: '2026-01-01', status: 'done', total: 4, done: 4, errors: 0, brands: cfg,
  engines: [{ id: 'chatgpt', label: 'ChatGPT', model: 'x' }, { id: 'gemini', label: 'Gemini', model: 'y' }],
  prompts: [
    { id: 'p1', text: 'כמה עולה להוסיף נהג מזדמן לפוליסה?', topic: 'נהג נוסף', intent: 'medium' },
    { id: 'p2', text: 'באיזו חברה תמליץ לי לעשות ביטוח רכב?', topic: 'המלצה כללית', intent: 'high' },
  ],
  answers: [
    answer('p1', 'chatgpt', 'בהפניקס זה זול ומהיר דרך האפליקציה.', [{ url: 'https://www.fnx.co.il/driver', title: '' }, { url: 'https://www.ynet.co.il/a', title: '' }]),
    answer('p1', 'gemini', 'הפניקס והראל מציעים מחיר משתלם.', [{ url: 'https://www.ynet.co.il/a', title: '' }]),
    answer('p2', 'chatgpt', '1. כלל ביטוח – שירות טוב\n2. הפניקס', [{ url: 'https://www.clalbit.co.il/car', title: '' }]),
    answer('p2', 'gemini', 'כלל ביטוח מובילה.'),
  ],
};

test('report finds the gap prompt and explains it', () => {
  const r = buildReport(run);
  assert.equal(r.kpi.gapPrompts, 1);
  assert.equal(r.rows[0].prompt.id, 'p1');
  const rec = r.recommendations.find((x) => x.promptId === 'p1');
  assert.ok(rec, 'p1 should have a recommendation');
  const types = rec.actions.map((a) => a.type);
  assert.ok(types.includes('content'));
  assert.ok(types.includes('third-party'));
  assert.ok(types.includes('competitor-page'));
  assert.ok(types.includes('claims-gap'));
  assert.deepEqual(rec.rivalUrls, ['https://www.fnx.co.il/driver']);
  assert.ok(!r.recommendations.find((x) => x.promptId === 'p2'), 'p2 is covered');
  const ynet = r.sources.find((s) => s.domain === 'ynet.co.il');
  assert.equal(ynet.withMainNoTarget, 2);
});

test('page comparison lists what the rival page has and ours lacks', () => {
  const q = 'כמה עולה להוסיף נהג מזדמן?';
  const rival = { url: 'r', ...auditHtml('<title>כמה עולה להוסיף נהג מזדמן</title><h1>נהג מזדמן</h1><p>המחיר 150 ₪</p><table></table><script type="application/ld+json">{"@type":"FAQPage"}</script>', q) };
  const own = { url: 'o', ...auditHtml('<title>ביטוח רכב</title><p>ביטוח רכב של כלל</p>', q) };
  const { missing } = comparePages(own, [rival]);
  const keys = missing.map((m) => m.key);
  assert.ok(keys.includes('priceNumbers'));
  assert.ok(keys.includes('tables'));
  assert.ok(keys.includes('faqSchema'));
});
