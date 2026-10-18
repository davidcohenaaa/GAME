// Builds a single self-contained HTML report from a run, to open offline or publish as a link.
// Usage: npm run export -- <runId|latest> [out.html]
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT, DATA_DIR } from './config.js';
import { loadRun, listRuns } from './store.js';
import { buildReport } from './recommend.js';

const read = (f) => fs.readFileSync(path.join(ROOT, 'public', f), 'utf8');
// Keep embedded JSON from closing the <script> tag early.
const safeJson = (v) => JSON.stringify(v).replace(/</g, '\\u003c').replace(/\u2028|\u2029/g, '');

export function exportHtml(run) {
  const report = buildReport(run);
  const data = {
    status: { engines: run.engines, mock: run.engines.some((e) => e.model === 'mock'), aiPlan: false, repetitions: run.repetitions },
    run: { id: run.id, startedAt: run.startedAt, finishedAt: run.finishedAt, status: run.status, label: run.label, done: run.done, total: run.total, errors: run.errors,
      engines: run.engines.map((e) => e.label), targetRate: report.kpi.targetRate, mainRate: report.kpi.mainRate },
    report,
    answers: run.answers,
  };
  const description = `כלל מוזכרת ב-${Math.round(report.kpi.targetRate * 100)}% מתשובות מנועי הבינה, ${report.brandNames[report.mainCompetitor]} ב-${Math.round(report.kpi.mainRate * 100)}%.`;
  return read('index.html')
    .replace('<title>GEO Tracker</title>', `<title>GEO Tracker Report</title>\n  <meta name="description" content="${description}">`)
    .replace('<link rel="stylesheet" href="styles.css">', () => `<style>\n${read('styles.css')}\n</style>`)
    .replace('<script type="module" src="app.js"></script>', () => `<script>window.STATIC_DATA = ${safeJson(data)};</script>\n  <script type="module">\n${read('app.js')}\n</script>`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [which = 'latest', out] = process.argv.slice(2);
  const run = which === 'latest' ? listRuns().find((r) => r.status === 'done') : loadRun(which);
  if (!run) {
    console.error('לא נמצאה הרצה שהסתיימה');
    process.exit(1);
  }
  const file = path.resolve(out || path.join(DATA_DIR, `report-${run.id}.html`));
  fs.writeFileSync(file, exportHtml(run));
  console.log(file);
}
