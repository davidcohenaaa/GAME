"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { EngineCoverage, ScoreRing, toneOf } from "./components/Charts";
import { ENGINES, type AnalysisResult, type Gap, type PageProfile, type Presence, type Recommendation, type RunResult } from "@/lib/types";

interface Score { key: string; name: string; score: number; isMe: boolean }

const chip = (p: Presence) =>
  p.linked ? <span className="chip link">🔗 לינק</span> : p.mentioned ? <span className="chip mention">✅ אזכור</span> : <span className="chip none">לא מופיע</span>;

export default function Dashboard() {
  const [run, setRun] = useState<RunResult | null>(null);
  const [scores, setScores] = useState<Score[]>([]);
  const [recs, setRecs] = useState<Recommendation[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  const load = useCallback(async () => {
    const r = await (await fetch("/api/results")).json();
    setRun(r.run);
    setScores(r.scoreboard ?? []);
    setLoaded(true);
    if (r.run) {
      setAnalysis((await (await fetch("/api/analysis")).json()).analysis);
      const rr = await (await fetch("/api/recommendations")).json();
      setRecs(rr.recommendations ?? []);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function start() {
    setBusy(true); setError("");
    const res = await fetch("/api/run", { method: "POST" });
    if (!res.ok) setError((await res.json()).error ?? "שגיאה");
    else await load();
    setBusy(false);
  }

  async function analyze() {
    setAnalyzing(true); setError("");
    const res = await fetch("/api/analysis", { method: "POST" });
    const j = await res.json();
    if (!res.ok) setError(j.error ?? "שגיאה"); else setAnalysis(j.analysis);
    setAnalyzing(false);
  }

  const me = scores.find((s) => s.isMe);

  return (
    <>
      <div className="row" style={{ justifyContent: "space-between", marginBottom: 16 }}>
        <h1 style={{ margin: 0 }}>הנראות שלי ב-AI</h1>
        <button onClick={start} disabled={busy}>{busy ? "בודק… (עד דקה)" : "▶ הרץ בדיקה"}</button>
      </div>
      {error && <p className="error">{error} — <Link href="/settings">להגדרות</Link></p>}

      {loaded && !run && !busy && (
        <div className="card">
          <p>עוד לא הרצת בדיקה. קודם <Link href="/settings">הגדר מותג, מתחרים ופרומפטים</Link> (אפשר מצב הדגמה בלי מפתחות), ואז לחץ "הרץ בדיקה".</p>
        </div>
      )}

      {run && me && (
        <>
          <div className="card score hero">
            <ScoreRing value={me.score} />
            <div>
              <strong className="score-title">ציון נראות (0–100)</strong>
              <span className={`pill ${toneOf(me.score)}`}>{me.score >= 60 ? "נראות גבוהה" : me.score >= 30 ? "יש מקום לשיפור" : "כמעט בלתי נראה"}</span>
              <div className="muted">
                🔗 לינק = 100% · ✅ אזכור = 60% · ❌ לא מופיע = 0
                <br />בדיקה אחרונה: {new Date(run.startedAt).toLocaleString("he-IL")}
              </div>
            </div>
          </div>

          <h2>איפה אני מופיע</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>פרומפט</th>
                  {run.engines.map((e) => <th key={e}>{ENGINES.find((x) => x.id === e)?.label}</th>)}
                </tr>
              </thead>
              <tbody>
                {run.prompts.map((p) => (
                  <tr key={p}>
                    <td>{p}</td>
                    {run.engines.map((e) => {
                      const c = run.cells.find((x) => x.prompt === p && x.engine === e);
                      return (
                        <td key={e} className="cell" title={c?.error ?? ""}>
                          {!c ? "—" : c.status === "error" ? <span title={c.error}>⚠️</span> : chip(c.me)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="muted">⚠️ = המנוע נכשל בשאילתה הזו</p>

          <h2>כיסוי לפי מנוע</h2>
          <EngineCoverage run={run} />

          <h2>אני מול המתחרים</h2>
          <div className="card bars">
            {[...scores].sort((a, b) => b.score - a.score).map((s) => (
              <div key={s.key} className={`bar ${s.isMe ? "me" : ""}`}>
                <span className="who"><i className="avatar">{s.name.trim().charAt(0).toUpperCase()}</i>{s.name}{s.isMe ? " (אני)" : ""}</span>
                <div className="track"><div className="fill" style={{ width: `${s.score}%` }} /></div>
                <strong>{s.score}</strong>
              </div>
            ))}
          </div>

          <div className="row" style={{ justifyContent: "space-between", marginTop: 32 }}>
            <h2 style={{ margin: 0 }}>מה המתחרים עושים ומה חסר לי</h2>
            <button onClick={analyze} disabled={analyzing || !run.competitors.length}>{analyzing ? "קורא דפים… (עד כמה דקות)" : analysis ? "↻ נתח שוב" : "🔍 נתח מתחרים"}</button>
          </div>
          {!analysis && !analyzing && <p className="muted">הכלי ייכנס לדפים שמצוטטים של המתחרים ושלך, יקרא אותם ויסביר מה הם עושים ומה חסר אצלך.</p>}
          {analysis && <AnalysisView a={analysis} />}

          <h2>בדיקות מהירות</h2>
          <ul className="recs">
            {recs.map((r, i) => (
              <li key={i}>
                <span className={`tag ${r.priority}`}>{r.priority === "high" ? "דחוף" : r.priority === "medium" ? "חשוב" : "נחמד"}</span>
                <div><strong>{r.title}</strong>{r.detail && <div className="muted">{r.detail}</div>}</div>
              </li>
            ))}
            {!recs.length && <li><span /> <span className="muted">אין המלצות כרגע 🎉</span></li>}
          </ul>
        </>
      )}
    </>
  );
}

const TYPE: Record<string, string> = { comparison: "השוואה", guide: "מדריך", product: "מוצר", faq: "שאלות נפוצות", blog: "בלוג", other: "אחר" };
const LEVEL: Record<string, string> = { high: "גבוה", medium: "בינוני", low: "נמוך" };

function Pages({ title, pages }: { title: string; pages: PageProfile[] }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <strong>{title}</strong>
      <ul className="muted" style={{ margin: "4px 0" }}>
        {pages.map((p) => (
          <li key={p.url} dir="auto">
            <span dir="ltr">{p.url.replace(/^https?:\/\//, "")}</span>{" "}
            {p.error ? <span className="error">({p.error})</span> : <>— {TYPE[p.type]} · {p.words} מילים · {p.faq} שאלות · {p.tables} טבלאות{p.schemaTypes.length ? ` · ${p.schemaTypes.join(", ")}` : ""}{p.cited ? ` · צוטט ${p.cited}×` : ""}</>}
          </li>
        ))}
      </ul>
    </div>
  );
}

function AnalysisView({ a }: { a: AnalysisResult }) {
  return (
    <>
      <p className="muted">נקראו {a.pagesRead} דפים · {a.mode === "ai" ? "ניתוח AI" : "השוואת עובדות (בלי AI)"} · {new Date(a.generatedAt).toLocaleString("he-IL")}</p>
      {a.warnings.map((w) => <p key={w} className="error">⚠️ {w}</p>)}
      <details className="card" style={{ marginBottom: 12 }}>
        <summary><strong>הדפים שנקראו</strong></summary>
        {a.competitors.map((c) => <Pages key={c.domain} title={c.name} pages={c.pages} />)}
        <Pages title="אני" pages={a.me} />
      </details>
      {a.gaps.length === 0 && <div className="card">לא נמצאו פרומפטים שבהם מתחרה מקדים אותך 🎉</div>}
      {a.gaps.map((g, i) => <GapCard key={i} g={g} open={i === 0} />)}
    </>
  );
}

function List({ items }: { items: string[] }) {
  return items.length ? <ul>{items.map((x, i) => <li key={i} dir="auto">{x}</li>)}</ul> : <p className="muted">—</p>;
}

function GapCard({ g, open }: { g: Gap; open: boolean }) {
  return (
    <details className="card" open={open} style={{ marginBottom: 12 }}>
      <summary>
        <strong>{g.prompt}</strong>
        <span className="muted"> · מנצחים: {g.winners.join(", ")} · השפעה {LEVEL[g.impact]} · מאמץ {LEVEL[g.effort]}</span>
      </summary>
      <div className="cols">
        <div><h3>🔎 מה הם עושים</h3><List items={g.theyDo} /></div>
        <div><h3>❗ מה חסר לנו</h3><List items={g.weMiss} /></div>
        <div>
          <h3>✅ מה לעשות</h3>
          {g.plan.pageTitle && <p><strong>דף מוצע:</strong> {g.plan.pageTitle}</p>}
          {g.plan.outline.length > 0 && <><strong>מבנה (H2):</strong><List items={g.plan.outline} /></>}
          {g.plan.faq.length > 0 && <><strong>שאלות FAQ לכתוב:</strong><List items={g.plan.faq} /></>}
          {g.plan.data.length > 0 && <><strong>נתונים להוסיף:</strong><List items={g.plan.data} /></>}
          {g.plan.external.length > 0 && <><strong>לקבל אזכור ב:</strong><List items={g.plan.external} /></>}
        </div>
      </div>
    </details>
  );
}
