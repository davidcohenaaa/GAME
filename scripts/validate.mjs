// Checks that the content files are consistent. Run: node scripts/validate.mjs
import { readFileSync, existsSync } from "node:fs";

const read = (path) => JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), "utf8"));
const errors = [];
const fail = (msg) => errors.push(msg);

const topics = read("content/topics.json");
const questions = read("content/questions.json");
const signs = read("content/signs.json");
const topicIds = new Set(topics.map((t) => t.id));

for (const t of topics) {
  if (!existsSync(new URL(`../content/topics/${t.id}.md`, import.meta.url)))
    fail(`נושא "${t.id}": חסר הקובץ content/topics/${t.id}.md`);
}

const seen = new Set();
for (const q of questions) {
  const where = `שאלה ${q.id ?? "(בלי id)"}`;
  if (!q.id) fail(`${where}: חסר id`);
  if (seen.has(q.id)) fail(`${where}: id כפול`);
  seen.add(q.id);
  if (!topicIds.has(q.topic)) fail(`${where}: נושא לא קיים "${q.topic}"`);
  if (!q.question?.trim()) fail(`${where}: חסר טקסט שאלה`);
  if (!Array.isArray(q.answers) || q.answers.length < 2) fail(`${where}: צריך לפחות 2 תשובות`);
  else if (!Number.isInteger(q.correct) || q.correct < 0 || q.correct >= q.answers.length)
    fail(`${where}: "correct" חייב להיות מספר בין 0 ל-${q.answers.length - 1}`);
  if (q.image && !existsSync(new URL(`../${q.image}`, import.meta.url)))
    fail(`${where}: קובץ התמונה לא נמצא (${q.image})`);
}

const signIds = new Set();
for (const s of signs) {
  if (signIds.has(s.id)) fail(`תמרור ${s.id}: id כפול`);
  signIds.add(s.id);
  for (const field of ["name", "category", "meaning"]) if (!s[field]) fail(`תמרור ${s.id}: חסר ${field}`);
  if (!s.image && !s.shape) fail(`תמרור ${s.id}: צריך image או shape`);
  if (s.image && !existsSync(new URL(`../${s.image}`, import.meta.url)))
    fail(`תמרור ${s.id}: קובץ התמונה לא נמצא (${s.image})`);
}

if (errors.length) {
  console.error(errors.map((e) => `✗ ${e}`).join("\n"));
  process.exit(1);
}
console.log(`הכול תקין: ${questions.length} שאלות, ${signs.length} תמרורים, ${topics.length} נושאים.`);
