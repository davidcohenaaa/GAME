import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { loadEnv, ROOT, readConfig, writeConfig, brandsConfigName } from './config.js';

loadEnv();

const { availableEngines } = await import('./engines/index.js');
const { claudeMessage } = await import('./engines/anthropic.js');
const { startRun, planRun, activeRun } = await import('./runner.js');
const { loadRun, listRuns } = await import('./store.js');
const { buildReport, aiPlan } = await import('./recommend.js');
const { startSchedule } = await import('./schedule.js');
const { auditUrl, comparePages } = await import('./pageAudit.js');

const PUBLIC = path.join(ROOT, 'public');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml' };

function send(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

async function readBody(req) {
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 1e6) throw new Error('body too large');
  }
  return raw ? JSON.parse(raw) : {};
}

function authorized(req, url) {
  const token = process.env.ACCESS_TOKEN;
  if (!token) return true;
  return req.headers.authorization === `Bearer ${token}` || url.searchParams.get('token') === token;
}

function runSummary(r) {
  const rep = r.status === 'done' ? buildReport(r) : null;
  return { id: r.id, startedAt: r.startedAt, finishedAt: r.finishedAt, status: r.status, label: r.label, done: r.done, total: r.total, errors: r.errors,
    engines: r.engines.map((e) => e.label), targetRate: rep?.kpi.targetRate ?? null, mainRate: rep?.kpi.mainRate ?? null };
}

async function api(req, res, url) {
  const p = url.pathname;
  if (p === '/api/status' && req.method === 'GET') {
    const engines = availableEngines().map((e) => ({ id: e.id, label: e.label, model: e.model }));
    return send(res, 200, { engines, mock: process.env.MOCK === '1', aiPlan: !!process.env.ANTHROPIC_API_KEY, repetitions: Number(process.env.REPETITIONS || 3) });
  }
  if (p === '/api/prompts' && req.method === 'GET') return send(res, 200, readConfig('prompts'));
  if (p === '/api/prompts' && req.method === 'PUT') {
    const body = await readBody(req);
    if (!Array.isArray(body.prompts)) return send(res, 400, { error: 'prompts must be an array' });
    const prompts = body.prompts.map((x, i) => ({ id: x.id || `p${String(i + 1).padStart(2, '0')}`, text: String(x.text || '').trim(), topic: String(x.topic || 'כללי'), intent: ['high', 'medium', 'low'].includes(x.intent) ? x.intent : 'medium' })).filter((x) => x.text);
    writeConfig('prompts', { prompts });
    return send(res, 200, { prompts });
  }
  if (p === '/api/brands' && req.method === 'GET') return send(res, 200, readConfig(brandsConfigName()));
  if (p === '/api/pages' && req.method === 'GET') return send(res, 200, readConfig('pages'));
  if (p === '/api/pages' && req.method === 'PUT') {
    const body = await readBody(req);
    const pages = Object.fromEntries(Object.entries(body.pages || {}).map(([k, v]) => [String(k), String(v || '').trim()]));
    writeConfig('pages', { ...readConfig('pages'), pages });
    return send(res, 200, { pages });
  }
  if (p === '/api/plan' && req.method === 'POST') {
    const { engines, prompts, reps, calls } = planRun(await readBody(req));
    return send(res, 200, { engines: engines.map((e) => e.label), prompts: prompts.length, reps, calls });
  }
  if (p === '/api/run' && req.method === 'POST') {
    const run = startRun(await readBody(req));
    return send(res, 202, { id: run.id, total: run.total });
  }
  if (p === '/api/runs' && req.method === 'GET') return send(res, 200, listRuns().map(runSummary));

  const m = p.match(/^\/api\/runs\/([\w-]+)(\/report|\/ai-plan|\/answers|\/page-audit)?$/);
  if (m) {
    const run = activeRun(m[1]) || loadRun(m[1]);
    if (!run) return send(res, 404, { error: 'run not found' });
    if (!m[2]) return send(res, 200, runSummary(run));
    if (m[2] === '/report') return send(res, 200, buildReport(run));
    if (m[2] === '/answers') {
      const promptId = url.searchParams.get('prompt');
      return send(res, 200, run.answers.filter((a) => !promptId || a.promptId === promptId));
    }
    if (m[2] === '/page-audit' && req.method === 'POST') {
      const { promptId } = await readBody(req);
      const rec = buildReport(run).recommendations.find((r) => r.promptId === promptId);
      if (!rec) return send(res, 404, { error: 'אין פער בפרומפט הזה' });
      const ownUrl = readConfig('pages').pages[rec.topic] || rec.ownUrls[0] || '';
      const [own, ...rivals] = await Promise.all([ownUrl ? auditUrl(ownUrl, rec.prompt) : null, ...rec.rivalUrls.slice(0, 4).map((u) => auditUrl(u, rec.prompt))]);
      return send(res, 200, { prompt: rec.prompt, topic: rec.topic, own, ownUrl, rivals, ...comparePages(own, rivals) });
    }
    if (m[2] === '/ai-plan' && req.method === 'POST') {
      if (!process.env.ANTHROPIC_API_KEY) return send(res, 400, { error: 'נדרש ANTHROPIC_API_KEY ליצירת תוכנית בעזרת Claude' });
      return send(res, 200, { markdown: await aiPlan(buildReport(run), process.env, claudeMessage) });
    }
  }
  return send(res, 404, { error: 'not found' });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  try {
    if (url.pathname.startsWith('/api/')) {
      if (!authorized(req, url)) return send(res, 401, { error: 'unauthorized' });
      return await api(req, res, url);
    }
    const file = path.join(PUBLIC, url.pathname === '/' ? 'index.html' : path.normalize(url.pathname));
    if (!file.startsWith(PUBLIC) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404);
      return res.end('not found');
    }
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  } catch (err) {
    send(res, 500, { error: String(err.message || err) });
  }
});

const port = Number(process.env.PORT || 8787);
const host = process.env.HOST || '127.0.0.1';
server.listen(port, host, () => {
  const engines = availableEngines();
  console.log(`GEO Tracker: http://${host === '0.0.0.0' ? 'localhost' : host}:${port}`);
  console.log(`מנועים פעילים: ${engines.map((e) => e.label).join(', ') || 'אין — הוסיפו מפתחות ל-.env או הריצו npm run mock'}`);
  if (host !== '127.0.0.1' && !process.env.ACCESS_TOKEN) console.warn('אזהרה: השרת פתוח לרשת בלי ACCESS_TOKEN');
  startSchedule();
});
