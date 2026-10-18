import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const DATA_DIR = path.join(ROOT, 'data');

export function loadEnv() {
  const file = path.join(ROOT, '.env');
  if (fs.existsSync(file)) process.loadEnvFile(file);
}

export function readConfig(name) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, 'config', `${name}.json`), 'utf8'));
}

export function writeConfig(name, value) {
  fs.writeFileSync(path.join(ROOT, 'config', `${name}.json`), JSON.stringify(value, null, 2) + '\n');
}
