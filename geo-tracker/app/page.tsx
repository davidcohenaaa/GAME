"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ENGINES, type Presence, type Recommendation, type RunResult } from "@/lib/types";

interface Score { key: string; name: string; score: number; isMe: boolean }

const tone = (n: number) => (n >= 60 ? "green" : n >= 30 ? "orange" : "red");
const icon = (p: Presence) => (p.linked ? "🔗" : p.mentioned ? "✅" : "❌");

export default function Dashboard() {
  const [run, setRun] = useState<RunResult | null>(null);
  const [scores, setScores] = useState<Score[]>([]);
  const [recs, setRecs] = useState<Recommendation[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const r = await (await fetch("/api/results")).json();
    setRun(r.run);
    setScores(r.scoreboard ?? []);
    setLoaded(true);
    if (r.run) {
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
          <div className="card score">
            <div className={`score-num ${tone(me.score)}`}>{me.score}</div>
            <div>
              <strong>ציון נראות (0–100)</strong>
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
                          {!c ? "—" : c.status === "error" ? <span title={c.error}>⚠️</span> : icon(c.me)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="muted">🔗 לינק לאתר · ✅ אזכור בשם · ❌ לא מופיע · ⚠️ המנוע נכשל</p>

          <h2>אני מול המתחרים</h2>
          <div className="card bars">
            {[...scores].sort((a, b) => b.score - a.score).map((s) => (
              <div key={s.key} className={`bar ${s.isMe ? "me" : ""}`}>
                <span>{s.name}{s.isMe ? " (אני)" : ""}</span>
                <div className="track"><div className="fill" style={{ width: `${s.score}%` }} /></div>
                <strong>{s.score}</strong>
              </div>
            ))}
          </div>

          <h2>מה לעשות כדי לעקוף אותם</h2>
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
