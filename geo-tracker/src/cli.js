// One-off run from the command line (e.g. from a system cron).
// npm run run-once -- [--engines claude,gemini] [--reps 3] [--prompts p01,p02] ["label"]
import { parseArgs } from 'node:util';
import { loadEnv } from './config.js';

loadEnv();
const { startRun, waitRun } = await import('./runner.js');
const { buildReport } = await import('./recommend.js');

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { engines: { type: 'string' }, reps: { type: 'string' }, prompts: { type: 'string' } },
});
const list = (s) => (s ? s.split(',').map((x) => x.trim()).filter(Boolean) : undefined);

const run = startRun({
  label: positionals[0] || 'הרצה מהטרמינל',
  engineIds: list(values.engines),
  promptIds: list(values.prompts),
  repetitions: values.reps,
});
console.log(`run ${run.id}: ${run.total} calls (${run.engines.map((e) => `${e.label} ${e.model}`).join(', ')})`);
const timer = setInterval(() => process.stdout.write(`\r${run.done}/${run.total} (errors: ${run.errors})`), 2000);
await waitRun(run.id);
clearInterval(timer);
const r = buildReport(run);
console.log(`\nכלל: ${Math.round(r.kpi.targetRate * 100)}% | ${r.brandNames[r.mainCompetitor]}: ${Math.round(r.kpi.mainRate * 100)}% | פרומפטים בפער: ${r.kpi.gapPrompts} | שגיאות: ${run.errors}`);
for (const rec of r.recommendations.slice(0, 5)) console.log(`- [${rec.score}] ${rec.prompt}`);
const firstError = run.answers.find((a) => a.error);
if (firstError) console.log(`שגיאה לדוגמה (${firstError.engine}): ${firstError.error}`);
console.log(`runId: ${run.id}`);
