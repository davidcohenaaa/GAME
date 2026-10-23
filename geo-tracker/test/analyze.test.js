import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { compileBrands, findMentions, domainOf, brandForDomain } from '../src/analyze.js';

const cfg = JSON.parse(fs.readFileSync(new URL('../config/brands.json', import.meta.url)));
const brands = compileBrands(cfg);
const ids = (t) => findMentions(t, brands).map((m) => m.brand);

test('strong aliases with Hebrew prefixes', () => {
  assert.deepEqual(ids('כדאי לבדוק בהפניקס ולהשוות לביטוח ישיר'), ['phoenix', 'direct']);
  assert.deepEqual(ids('ממליץ על כלל ביטוח'), ['clal']);
  assert.deepEqual(ids('Clal Insurance is good'), ['clal']);
});

test('niqqud is ignored', () => {
  assert.deepEqual(ids('הַפֵּנִיקְס'), ['phoenix']);
});

test('generic word "כלל" is not the brand', () => {
  assert.deepEqual(ids('ככלל, כדאי להשוות מחירים. בכלל לא משנה.'), []);
  assert.deepEqual(ids('כלל החברות מציעות הנחה'), []);
});

test('"כלל" as brand in a list or next to another insurer', () => {
  assert.deepEqual(ids('1. **כלל** – שירות טוב\n2. **הראל** – מחיר נמוך'), ['clal', 'harel']);
  assert.deepEqual(ids('החברות המובילות: הפניקס, כלל ומגדל'), ['phoenix', 'clal', 'migdal']);
  assert.deepEqual(ids('כלל ביטוחים מציעה מסלול'), ['clal']);
});

test('ambiguous "הכשרה" (training) needs context', () => {
  assert.deepEqual(ids('נדרשת הכשרה מעשית לנהיגה'), []);
  assert.deepEqual(ids('הכשרה ביטוח מציעה מחיר טוב'), ['hachshara']);
});

test('rank, sentiment and attributes', () => {
  const m = findMentions('הפניקס מומלצת בזכות שירות מעולה ומוסכי הסדר. כלל ביטוח יקרה יותר.', brands);
  assert.equal(m[0].brand, 'phoenix');
  assert.equal(m[0].rank, 1);
  assert.equal(m[0].sentiment, 'positive');
  assert.ok(m[0].attributes.includes('garages'));
  assert.ok(m[0].attributes.includes('service'));
  assert.equal(m[1].sentiment, 'negative');
});

test('complaints do not count as reasons to recommend', () => {
  const [m] = findMentions('הפניקס – יש תלונות על זמני טיפול בתביעות', brands);
  assert.equal(m.sentiment, 'negative');
  assert.deepEqual(m.attributes, []);
});

test('citation domains map to brands', () => {
  assert.equal(domainOf('https://www.fnx.co.il/car'), 'fnx.co.il');
  assert.equal(brandForDomain('fnx.co.il', cfg), 'phoenix');
  assert.equal(brandForDomain('www2.clalbit.co.il'.replace(/^www\./, ''), cfg), 'clal');
  assert.equal(brandForDomain('ynet.co.il', cfg), null);
});

test('demo mode uses the fictional brands file', async () => {
  const { brandsConfigName } = await import('../src/config.js');
  const prev = process.env.MOCK;
  process.env.MOCK = '1';
  assert.equal(brandsConfigName(), 'brands.demo');
  process.env.MOCK = '0';
  assert.equal(brandsConfigName(), 'brands');
  process.env.MOCK = prev;
});
