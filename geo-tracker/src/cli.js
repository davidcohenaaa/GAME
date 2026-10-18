// One-off run from the command line (e.g. from a system cron): npm run run-once
import { loadEnv } from './config.js';

loadEnv();
const { startRun, waitRun } = await import('./runner.js');
const { buildReport } = await import('./recommend.js');

const run = startRun({ label: process.argv[2] || 'הרצה מהטרמינל' });
console.log(`run ${run.id}: ${run.total} calls`);
const timer = setInterval(() => process.stdout.write(`\r${run.done}/${run.total} (errors: ${run.errors})`), 2000);
await waitRun(run.id);
clearInterval(timer);
const r = buildReport(run);
console.log(`\nכלל: ${Math.round(r.kpi.targetRate * 100)}% | ${r.brandNames[r.mainCompetitor]}: ${Math.round(r.kpi.mainRate * 100)}% | פרומפטים בפער: ${r.kpi.gapPrompts}`);
for (const rec of r.recommendations.slice(0, 5)) console.log(`- [${rec.score}] ${rec.prompt}`);
