import { availableEngines } from './engines/index.js';
import { analyzeAnswer, compileBrands } from './analyze.js';
import { readConfig, brandsConfigName } from './config.js';
import { saveRun } from './store.js';

const active = new Map();
const pending = new Map();

export function waitRun(id) {
  return pending.get(id) || Promise.resolve(null);
}

export function activeRun(id) {
  return active.get(id);
}

export function planRun({ engineIds, promptIds, repetitions } = {}) {
  const engines = availableEngines().filter((e) => !engineIds?.length || engineIds.includes(e.id));
  const prompts = readConfig('prompts').prompts.filter((p) => !promptIds?.length || promptIds.includes(p.id));
  const reps = Math.max(1, Math.min(10, Number(repetitions || process.env.REPETITIONS || 3)));
  return { engines, prompts, reps, calls: engines.length * prompts.length * reps };
}

export function startRun(options = {}) {
  const { engines, prompts, reps, calls } = planRun(options);
  if (!calls) throw new Error('אין מנועים פעילים או פרומפטים לבדיקה. בדקו את המפתחות בקובץ .env');
  const brandsConfig = readConfig(brandsConfigName());
  const compiled = compileBrands(brandsConfig);
  const run = {
    id: new Date().toISOString().replace(/[:.]/g, '-'),
    startedAt: new Date().toISOString(),
    finishedAt: null,
    status: 'running',
    label: options.label || '',
    engines: engines.map((e) => ({ id: e.id, label: e.label, model: e.model })),
    prompts,
    brands: brandsConfig,
    repetitions: reps,
    total: calls,
    done: 0,
    errors: 0,
    answers: [],
  };
  active.set(run.id, run);
  saveRun(run);

  const concurrency = Math.max(1, Number(process.env.CONCURRENCY || 2));
  const perEngine = engines.map(async (engine) => {
    const jobs = prompts.flatMap((p) => Array.from({ length: reps }, (_, rep) => ({ p, rep })));
    const worker = async () => {
      while (jobs.length) {
        const { p, rep } = jobs.shift();
        const base = { promptId: p.id, engine: engine.id, rep, at: new Date().toISOString() };
        try {
          const ans = await engine.ask(p.text, rep);
          run.answers.push({ ...base, text: ans.text, ...analyzeAnswer(ans, compiled, brandsConfig) });
        } catch (err) {
          run.errors++;
          run.answers.push({ ...base, error: String(err.message || err).slice(0, 500), mentions: [], citations: [] });
        }
        run.done++;
        if (run.done % 5 === 0) saveRun(run);
      }
    };
    await Promise.all(Array.from({ length: concurrency }, worker));
  });

  pending.set(run.id, Promise.all(perEngine).then(() => {
    run.status = 'done';
    run.finishedAt = new Date().toISOString();
    saveRun(run);
    active.delete(run.id);
    pending.delete(run.id);
    return run;
  }));
  return run;
}
