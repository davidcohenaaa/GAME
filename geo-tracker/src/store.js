// Runs are stored as one JSON file each under data/.
import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR } from './config.js';

fs.mkdirSync(DATA_DIR, { recursive: true });
const fileOf = (id) => path.join(DATA_DIR, `run-${id.replace(/[^\w-]/g, '')}.json`);

export function saveRun(run) {
  const tmp = fileOf(run.id) + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(run));
  fs.renameSync(tmp, fileOf(run.id));
}

export function loadRun(id) {
  const f = fileOf(id);
  return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null;
}

export function listRuns() {
  return fs.readdirSync(DATA_DIR)
    .filter((f) => /^run-.*\.json$/.test(f))
    .map((f) => JSON.parse(fs.readFileSync(path.join(DATA_DIR, f), 'utf8')))
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}
