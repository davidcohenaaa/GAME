const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const pc = (x) => `${Math.round((x || 0) * 100)}%`;

const token = new URLSearchParams(location.search).get('token') || '';
async function api(path, opts = {}) {
  const res = await fetch(path, {
    ...opts,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

const state = { status: null, runs: [], report: null, runId: null };

// ---------- tabs ----------
document.querySelectorAll('.tabs button').forEach((b) => b.addEventListener('click', () => {
  document.querySelectorAll('.tabs button').forEach((x) => x.classList.toggle('active', x === b));
  document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.id === `tab-${b.dataset.tab}`));
}));

// ---------- rendering ----------
function bar(value, cls = '') {
  return `<div class="meter ${cls}"><div style="width:${Math.round((value || 0) * 100)}%"></div></div>`;
}

function renderOverview(r) {
  const k = r.kpi;
  const main = r.brandNames[r.mainCompetitor];
  document.querySelectorAll('.mainName').forEach((e) => { e.textContent = main; });
  $('#kpis').innerHTML = [
    ['כלל מוזכרת', pc(k.targetRate), `${main}: ${pc(k.mainRate)}`, k.targetRate >= k.mainRate ? 'good' : 'bad'],
    ['כלל ראשונה ברשימה', pc(k.targetFirst), `${main}: ${pc(k.mainFirst)}`, k.targetFirst >= k.mainFirst ? 'good' : 'bad'],
    ['תאים מכוסים', `${k.coveredCells}/${k.totalCells}`, 'פרומפט×מנוע עם אזכור ב-50%+', k.coveredCells === k.totalCells ? 'good' : ''],
    ['פרומפטים בפער', k.gapPrompts, `${main} מוזכרת יותר מכלל`, k.gapPrompts ? 'bad' : 'good'],
  ].map(([t, v, s, c]) => `<div class="kpi ${c}"><div class="muted small">${t}</div><div class="kpi-v">${v}</div><div class="muted small">${esc(s)}</div></div>`).join('');

  $('#sov').innerHTML = r.sov.filter((s) => s.rate > 0 || s.brand === r.target).map((s) => `
    <div class="sov-row ${s.brand === r.target ? 'is-target' : ''} ${s.brand === r.mainCompetitor ? 'is-main' : ''}">
      <span class="sov-name">${esc(s.name)}</span>${bar(s.rate, s.brand === r.target ? 'target' : s.brand === r.mainCompetitor ? 'main' : '')}<span class="sov-v">${pc(s.rate)}</span>
    </div>`).join('');

  const gap = r.attributeGap.filter((a) => a.rival > 0 || a.target > 0);
  $('#attrGap').innerHTML = gap.length ? `<table class="compact"><thead><tr><th>נימוק</th><th>${esc(main)}</th><th>כלל</th></tr></thead><tbody>${gap.map((a) => `
    <tr class="${a.rival - a.target >= 0.2 ? 'row-bad' : ''}"><td>${esc(a.label)}</td><td>${pc(a.rival)}</td><td>${pc(a.target)}</td></tr>`).join('')}</tbody></table>`
    : '<p class="muted">אין מספיק נתונים.</p>';

  $('#perEngine').innerHTML = `<table class="compact"><thead><tr><th>מנוע</th><th>כלל</th><th>${esc(main)}</th><th></th></tr></thead><tbody>${r.engines.map((e) => {
    const t = r.sov.find((s) => s.brand === r.target)?.perEngine[e.id] || 0;
    const m = r.sov.find((s) => s.brand === r.mainCompetitor)?.perEngine[e.id] || 0;
    return `<tr><td>${esc(e.label)} <span class="muted small">${esc(e.model)}</span></td><td>${pc(t)}</td><td>${pc(m)}</td><td>${t < m ? '<span class="chip missing">פער</span>' : '<span class="chip present">תקין</span>'}</td></tr>`;
  }).join('')}</tbody></table>`;
}

function renderRecs(r) {
  $('#aiPlanBtn').hidden = !state.status?.aiPlan;
  if (!r.recommendations.length) {
    $('#recs').innerHTML = '<p class="good-text">כלל מכוסה בכל הפרומפטים ובכל המנועים. 🎉</p>';
    return;
  }
  $('#recs').innerHTML = r.recommendations.map((x) => `
    <details class="rec">
      <summary>
        <span class="score" title="ציון עדיפות">${x.score}</span>
        <span class="rec-q">${esc(x.prompt)}</span>
        <span class="muted small">${esc(x.topic)} · כלל ${pc(x.rate)} · ${esc(x.mainName)} ${pc(x.mainRate)}${x.missingEngines.length ? ` · חסרה ב: ${esc(x.missingEngines.join(', '))}` : ''}</span>
      </summary>
      <ol class="actions">${x.actions.map((a) => `
        <li class="act act-${a.type}"><strong>${esc(a.title)}</strong><div>${esc(a.detail)}</div>
          ${a.quotes?.length ? `<div class="quotes">${a.quotes.map((q) => `<blockquote>“${esc(q)}”</blockquote>`).join('')}</div>` : ''}
        </li>`).join('')}</ol>
      <div class="row-start">
        <button data-audit="${esc(x.promptId)}">בדיקת עמודים מול המתחרים</button>
        <button data-answers="${esc(x.promptId)}">התשובות המלאות</button>
      </div>
      <div class="audit" id="audit-${esc(x.promptId)}"></div>
    </details>`).join('');
}

const STATUS_LABEL = { lead: 'ראשונה', present: 'מוזכרת', weak: 'לפעמים', missing: 'חסרה', absent: '—', nodata: 'שגיאה' };
function renderMatrix(r) {
  const head = `<thead><tr><th>פרומפט</th><th>נושא</th>${r.engines.map((e) => `<th>${esc(e.label)}</th>`).join('')}<th>כלל</th><th>${esc(r.brandNames[r.mainCompetitor])}</th></tr></thead>`;
  const body = r.rows.map((row) => `<tr>
    <td><a href="#" data-answers="${esc(row.prompt.id)}">${esc(row.prompt.text)}</a></td><td class="muted small">${esc(row.prompt.topic)}</td>
    ${r.engines.map((e) => {
      const c = row.cells[e.id];
      return `<td><span class="chip ${c.status}" title="כלל ${pc(c.rate)}, ראשונה ${pc(c.firstRate)}, ${esc(r.brandNames[r.mainCompetitor])} ${pc(c.mainRate)}">${STATUS_LABEL[c.status]} ${c.n ? pc(c.rate) : ''}</span></td>`;
    }).join('')}
    <td>${pc(row.rate)}</td><td>${pc(row.mainRate)}</td></tr>`).join('');
  $('#matrix').innerHTML = head + `<tbody>${body}</tbody>`;
}

const KIND = { own: 'כלל', competitor: 'מתחרה', 'third-party': 'צד ג׳' };
function renderSources(r) {
  if (!r.sources.length) {
    $('#sources').innerHTML = '<tr><td class="muted">המנועים לא החזירו מקורות בהרצה הזו.</td></tr>';
    return;
  }
  $('#sources').innerHTML = `<thead><tr><th>דומיין</th><th>סוג</th><th>צוטט בתשובות</th><th>מתוכן עם כלל</th><th>כשהמתחרה מוזכר וכלל לא</th><th>מנועים</th></tr></thead><tbody>${r.sources.slice(0, 60).map((s) => `
    <tr class="${s.kind === 'third-party' && s.withMainNoTarget > s.withTarget ? 'row-bad' : ''}">
      <td><a href="${esc(s.urls[0] || `https://${s.domain}`)}" target="_blank" rel="noopener" dir="ltr">${esc(s.domain)}</a></td>
      <td><span class="chip kind-${s.kind}">${KIND[s.kind]}${s.brand && s.kind === 'competitor' ? ` · ${esc(r.brandNames[s.brand])}` : ''}</span></td>
      <td>${s.answers}</td><td>${s.withTarget}</td><td><strong>${s.withMainNoTarget}</strong></td><td class="muted small">${esc(s.engines.join(', '))}</td>
    </tr>`).join('')}</tbody>`;
}

function renderHistory() {
  const done = state.runs.filter((x) => x.status === 'done').slice().reverse();
  const w = 640; const h = 160; const pad = 24;
  const pts = (key) => done.map((x, i) => `${pad + (i * (w - 2 * pad)) / Math.max(1, done.length - 1)},${h - pad - (x[key] || 0) * (h - 2 * pad)}`).join(' ');
  $('#trend').innerHTML = done.length > 1 ? `
    <svg viewBox="0 0 ${w} ${h}" class="trend" role="img" aria-label="מגמת כיסוי">
      <line x1="${pad}" y1="${h - pad}" x2="${w - pad}" y2="${h - pad}" class="axis"/>
      <polyline points="${pts('mainRate')}" class="line-main"/>
      <polyline points="${pts('targetRate')}" class="line-target"/>
    </svg>
    <div class="legend"><span class="dot target"></span>כלל <span class="dot main"></span>${esc(state.report?.brandNames[state.report.mainCompetitor] || 'הפניקס')}</div>`
    : '<p class="muted small">גרף המגמה יופיע אחרי שתי הרצות לפחות.</p>';
  $('#history').innerHTML = `<thead><tr><th>תאריך</th><th>תווית</th><th>מנועים</th><th>כלל</th><th>מתחרה ראשי</th><th>שגיאות</th></tr></thead><tbody>${state.runs.map((x) => `
    <tr><td>${new Date(x.startedAt).toLocaleString('he-IL')}</td><td>${esc(x.label)}</td><td class="small">${esc(x.engines.join(', '))}</td>
    <td>${x.targetRate == null ? x.status : pc(x.targetRate)}</td><td>${x.mainRate == null ? '' : pc(x.mainRate)}</td><td>${x.errors}</td></tr>`).join('')}</tbody>`;
}

function render() {
  const r = state.report;
  $('#empty').hidden = !!r;
  if (!r) return;
  renderOverview(r);
  renderRecs(r);
  renderMatrix(r);
  renderSources(r);
  renderHistory();
}

// ---------- detail dialogs ----------
function highlight(text, mentions, names) {
  let html = esc(text);
  const words = [...new Set(Object.values(names))].filter((n) => mentions.some((m) => names[m.brand] === n));
  for (const w of words) html = html.split(esc(w)).join(`<mark>${esc(w)}</mark>`);
  return html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');
}

async function showAnswers(promptId) {
  const list = await api(`/api/runs/${state.runId}/answers?prompt=${encodeURIComponent(promptId)}`);
  const r = state.report;
  const p = r.rows.find((x) => x.prompt.id === promptId)?.prompt;
  $('#detailTitle').textContent = p?.text || promptId;
  const label = Object.fromEntries(r.engines.map((e) => [e.id, e.label]));
  $('#detailBody').innerHTML = list.map((a) => `
    <article class="answer">
      <header><strong>${esc(label[a.engine])}</strong> <span class="muted small">חזרה ${a.rep + 1}</span>
        ${a.mentions.map((m) => `<span class="chip ${m.brand === r.target ? 'lead' : 'neutral'}">${m.rank}. ${esc(r.brandNames[m.brand])}</span>`).join('')}
        ${a.mentions.some((m) => m.brand === r.target) ? '' : '<span class="chip missing">כלל לא מוזכרת</span>'}
      </header>
      ${a.error ? `<p class="bad-text">${esc(a.error)}</p>` : `<div class="answer-text">${highlight(a.text, a.mentions, r.brandNames)}</div>`}
      ${a.citations.length ? `<div class="cites">${a.citations.slice(0, 12).map((c) => `<a href="${esc(c.url)}" target="_blank" rel="noopener" class="chip kind-${c.brand === r.target ? 'own' : c.brand ? 'competitor' : 'third-party'}" dir="ltr">${esc(c.domain || c.title || c.url)}</a>`).join('')}</div>` : ''}
    </article>`).join('');
  $('#detailDialog').showModal();
}

async function runAudit(promptId) {
  const box = document.getElementById(`audit-${promptId}`);
  box.innerHTML = '<p class="muted">טוען ובודק עמודים…</p>';
  try {
    const a = await api(`/api/runs/${state.runId}/page-audit`, { method: 'POST', body: { promptId } });
    const rivals = a.rivals.filter((x) => !x.error);
    box.innerHTML = `
      ${a.ownUrl ? `<p>העמוד של כלל: <a href="${esc(a.ownUrl)}" target="_blank" rel="noopener">${esc(a.ownUrl)}</a>${a.own?.error ? ` <span class="bad-text">(${esc(a.own.error)})</span>` : ''}</p>`
        : `<p class="bad-text">אין לכלל עמוד שמשויך לנושא "${esc(a.topic)}" ואף מנוע לא ציטט עמוד של כלל. הגדירו עמוד בלשונית ההגדרות — או שזה בדיוק הפער: צריך ליצור אותו.</p>`}
      ${!a.rivals.length ? '<p class="muted">המנועים לא ציטטו עמודי מתחרים בשאלה הזו.</p>' : ''}
      ${a.missing.length ? `<h4>מה יש אצל המתחרים וחסר אצלך:</h4><ul class="missing-list">${a.missing.map((m) => `<li><strong>${esc(m.label)}</strong> — ב-${m.rivalsWith}/${m.of} עמודי מתחרים. <span class="muted small">${esc(m.example)}</span></li>`).join('')}</ul>`
        : rivals.length ? '<p class="good-text">העמוד שלך כולל את כל מה שיש בעמודי המתחרים שנבדקו.</p>' : ''}
      ${rivals.length ? `<table class="compact"><thead><tr><th>עמוד</th><th>מילים</th><th>מחירים</th><th>טבלאות</th><th>FAQ Schema</th><th>תאריך עדכון</th></tr></thead><tbody>
        ${[a.own && !a.own.error ? { ...a.own, mine: true } : null, ...rivals].filter(Boolean).map((p) => `<tr class="${p.mine ? 'is-target' : ''}"><td class="small"><a href="${esc(p.url)}" target="_blank" rel="noopener">${esc(p.title || p.url)}</a>${p.mine ? ' (כלל)' : ''}</td><td>${p.words}</td><td>${p.signals.priceNumbers}</td><td>${p.signals.tables}</td><td>${p.signals.faqSchema ? '✓' : '—'}</td><td>${p.signals.updatedDate ? '✓' : '—'}</td></tr>`).join('')}
      </tbody></table>` : ''}`;
  } catch (err) {
    box.innerHTML = `<p class="bad-text">${esc(err.message)}</p>`;
  }
}

document.addEventListener('click', (e) => {
  const ans = e.target.closest('[data-answers]');
  if (ans) { e.preventDefault(); showAnswers(ans.dataset.answers); }
  const aud = e.target.closest('[data-audit]');
  if (aud) runAudit(aud.dataset.audit);
});
$('#detailClose').addEventListener('click', () => $('#detailDialog').close());

$('#aiPlanBtn').addEventListener('click', async () => {
  const box = $('#aiPlan');
  box.hidden = false;
  box.textContent = 'Claude כותב תוכנית פעולה…';
  try {
    const { markdown } = await api(`/api/runs/${state.runId}/ai-plan`, { method: 'POST' });
    box.innerHTML = mdToHtml(markdown);
  } catch (err) {
    box.innerHTML = `<p class="bad-text">${esc(err.message)}</p>`;
  }
});

// Minimal Markdown rendering for the AI plan (headings, lists, bold).
function mdToHtml(md) {
  const lines = esc(md).split('\n');
  let html = ''; let list = null;
  const inline = (s) => s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  for (const l of lines) {
    const li = l.match(/^\s*(?:[-*]|\d+\.)\s+(.*)/);
    if (li) { if (!list) { html += '<ul>'; list = true; } html += `<li>${inline(li[1])}</li>`; continue; }
    if (list) { html += '</ul>'; list = null; }
    const h = l.match(/^(#{1,4})\s+(.*)/);
    if (h) html += `<h${h[1].length + 1}>${inline(h[2])}</h${h[1].length + 1}>`;
    else if (l.trim()) html += `<p>${inline(l)}</p>`;
  }
  return html + (list ? '</ul>' : '');
}

// ---------- runs ----------
async function loadRuns(selectId) {
  state.runs = await api('/api/runs');
  const sel = $('#runSelect');
  sel.innerHTML = state.runs.map((r) => `<option value="${r.id}">${new Date(r.startedAt).toLocaleString('he-IL')}${r.label ? ` · ${esc(r.label)}` : ''}${r.status !== 'done' ? ' (רץ…)' : ''}</option>`).join('');
  const id = selectId || state.runs.find((r) => r.status === 'done')?.id || state.runs[0]?.id;
  if (id) { sel.value = id; await loadReport(id); } else render();
}

async function loadReport(id) {
  state.runId = id;
  state.report = await api(`/api/runs/${id}/report`);
  $('#aiPlan').hidden = true;
  render();
  const summary = state.runs.find((r) => r.id === id);
  if (summary?.status === 'running') watch(id);
}
$('#runSelect').addEventListener('change', (e) => loadReport(e.target.value));

let watching = null;
function watch(id) {
  if (watching === id) return;
  watching = id;
  $('#progress').hidden = false;
  const tick = async () => {
    const s = await api(`/api/runs/${id}`);
    $('#progressText').textContent = `מריץ: ${s.done}/${s.total} תשובות${s.errors ? ` · ${s.errors} שגיאות` : ''}`;
    $('#progressBar').style.width = `${Math.round((s.done / s.total) * 100)}%`;
    if (s.status === 'done') {
      $('#progress').hidden = true;
      watching = null;
      await loadRuns(id);
    } else {
      if (s.done % 10 === 0 && state.runId === id) state.report = await api(`/api/runs/${id}/report`), render();
      setTimeout(tick, 2500);
    }
  };
  tick();
}

async function refreshPlan() {
  const engineIds = [...document.querySelectorAll('#runEngines input:checked')].map((i) => i.value);
  const p = await api('/api/plan', { method: 'POST', body: { engineIds, repetitions: $('#runReps').value } });
  $('#runPlan').textContent = `${p.prompts} פרומפטים × ${p.engines.length} מנועים × ${p.reps} חזרות = ${p.calls} קריאות API`;
  $('#runStart').disabled = !p.calls;
}

$('#newRunBtn').addEventListener('click', async () => {
  const engines = state.status.engines;
  $('#runEngines').innerHTML = engines.length
    ? engines.map((e) => `<label class="check"><input type="checkbox" value="${e.id}" checked> ${esc(e.label)} <span class="muted small">${esc(e.model)}</span></label>`).join('')
    : '<p class="bad-text">אין מנועים פעילים. הוסיפו מפתחות API לקובץ .env והפעילו מחדש את השרת.</p>';
  $('#runReps').value = state.status.repetitions;
  await refreshPlan();
  $('#runDialog').showModal();
});
$('#runEngines').addEventListener('change', refreshPlan);
$('#runReps').addEventListener('input', refreshPlan);
$('#runForm').addEventListener('submit', async (e) => {
  if (e.submitter?.value !== 'ok') return;
  const engineIds = [...document.querySelectorAll('#runEngines input:checked')].map((i) => i.value);
  const { id } = await api('/api/run', { method: 'POST', body: { engineIds, repetitions: $('#runReps').value, label: $('#runLabel').value } });
  await loadRuns(id);
  watch(id);
});

// ---------- settings ----------
async function loadSettings() {
  $('#engineList').innerHTML = state.status.engines.length
    ? state.status.engines.map((e) => `<span class="chip present">${esc(e.label)} · ${esc(e.model)}</span>`).join(' ')
    : '<p class="bad-text">אין מנועים פעילים.</p>';
  const { prompts } = await api('/api/prompts');
  $('#promptsText').value = prompts.map((p) => `${p.text} | ${p.topic} | ${p.intent}`).join('\n');
  const { pages } = await api('/api/pages');
  $('#pagesForm').innerHTML = Object.entries(pages).map(([topic, url]) => `
    <label class="page-row"><span>${esc(topic)}</span><input type="url" data-topic="${esc(topic)}" value="${esc(url)}" placeholder="https://www.clalbit.co.il/..." dir="ltr"></label>`).join('');
}
$('#savePrompts').addEventListener('click', async () => {
  const prompts = $('#promptsText').value.split('\n').map((l) => l.split('|').map((x) => x.trim())).filter(([t]) => t)
    .map(([text, topic, intent], i) => ({ id: `p${String(i + 1).padStart(2, '0')}`, text, topic: topic || 'כללי', intent: intent || 'medium' }));
  const saved = await api('/api/prompts', { method: 'PUT', body: { prompts } });
  $('#promptsSaved').textContent = `נשמרו ${saved.prompts.length} פרומפטים`;
});
$('#savePages').addEventListener('click', async () => {
  const pages = Object.fromEntries([...document.querySelectorAll('#pagesForm input')].map((i) => [i.dataset.topic, i.value]));
  await api('/api/pages', { method: 'PUT', body: { pages } });
  $('#pagesSaved').textContent = 'נשמר';
});

// ---------- boot ----------
(async () => {
  try {
    state.status = await api('/api/status');
    $('#mockBanner').hidden = !state.status.mock;
    await Promise.all([loadRuns(), loadSettings()]);
  } catch (err) {
    document.body.insertAdjacentHTML('afterbegin', `<div class="banner bad">${esc(err.message)}</div>`);
  }
})();
