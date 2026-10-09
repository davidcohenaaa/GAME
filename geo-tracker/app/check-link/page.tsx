"use client";
import { useState } from "react";
import { ENGINES, type PageRead } from "@/lib/types";

interface Bot { bot: string; label: string; robots: string; fetchStatus: number | null; ok: boolean }
interface Result {
  url: string; finalUrl: string; status: number; noindex: boolean; title?: string; hasSchema: boolean;
  hasSitemap: boolean; read?: PageRead; bots: Bot[]; issues: string[]; citedBy: string[]; domainCited: boolean; hasRun: boolean; error?: string;
}

export default function CheckLink() {
  const [url, setUrl] = useState("");
  const [res, setRes] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);

  async function go() {
    setBusy(true); setRes(null);
    const r = await fetch("/api/check-link", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url }) });
    setRes(await r.json());
    setBusy(false);
  }

  const good = res && !res.error && res.issues.length === 0;

  return (
    <>
      <h1>האם הלינק שלי נסרק?</h1>
      <div className="card row">
        <input style={{ flex: 1 }} dir="ltr" placeholder="https://example.com/page" value={url}
          onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => e.key === "Enter" && url && go()} />
        <button onClick={go} disabled={busy || !url}>{busy ? "בודק…" : "בדוק"}</button>
      </div>

      {res?.error && <p className="error">{res.error}</p>}

      {res && !res.error && (
        <>
          <h2 className={good ? "ok" : ""}>{good ? "✅ הכל תקין – בוטים של AI יכולים לסרוק את הדף" : "יש דברים לתקן"}</h2>
          <div className="lights">
            {res.bots.map((b) => (
              <div key={b.bot} className="light">
                <span className={`dot ${b.ok ? "g" : "r"}`} />
                <div><strong>{b.label}</strong>
                  <div className="muted" dir="ltr">{b.bot} · {b.robots === "blocked" ? "חסום ב-robots" : b.fetchStatus ? `HTTP ${b.fetchStatus}` : "מותר"}</div>
                </div>
              </div>
            ))}
            <div className="light"><span className={`dot ${res.status < 400 ? "g" : "r"}`} /><strong>סטטוס דף: {res.status}</strong></div>
            <div className="light"><span className={`dot ${res.noindex ? "r" : "g"}`} /><strong>{res.noindex ? "noindex" : "ניתן לאינדוקס"}</strong></div>
            <div className="light"><span className={`dot ${res.hasSchema ? "g" : "o"}`} /><strong>{res.hasSchema ? "יש Schema" : "אין Schema"}</strong></div>
            <div className="light"><span className={`dot ${res.hasSitemap ? "g" : "o"}`} /><strong>{res.hasSitemap ? "יש Sitemap" : "אין Sitemap"}</strong></div>
          </div>


          {res.read && <ReadCard r={res.read} />}

          <h2>האם מנועי AI ציטטו אותו?</h2>
          <div className="card">
            {!res.hasRun ? <span className="muted">עוד לא הרצת בדיקה בדשבורד.</span>
              : res.citedBy.length ? <>✅ הדף עצמו צוטט ב: {res.citedBy.map((e) => ENGINES.find((x) => x.id === e)?.label).join(", ")}</>
              : res.domainCited ? <>🟡 הדף לא צוטט, אבל דפים אחרים מהדומיין צוטטו.</>
              : <>❌ הדומיין לא צוטט בבדיקה האחרונה.</>}
          </div>

          {res.issues.length > 0 && (<>
            <h2>מה לתקן</h2>
            <ul className="recs">{res.issues.map((i) => <li key={i}><span className="tag medium">תקן</span><div>{i}</div></li>)}</ul>
          </>)}
        </>
      )}
    </>
  );
}

function ReadCard({ r }: { r: PageRead }) {
  const u = r.understanding;
  const seen = r.raw.wordCount;
  const full = r.rendered?.wordCount ?? seen;
  const tone = u.clarityScore >= 70 ? "green" : u.clarityScore >= 40 ? "orange" : "red";
  return (
    <>
      <h2>מה בוט של AI באמת קרא בדף</h2>
      <div className="card">
        <div className="score" style={{ marginBottom: 12 }}>
          <div className={`score-num ${tone}`} style={{ fontSize: 48 }}>{u.clarityScore}</div>
          <div>
            <strong>ציון הבנה (0–100)</strong>
            <div className="muted">{u.source === "ai" ? "ה-AI קרא את הטקסט וסיכם אותו" : "ניתוח מבני בלבד – הוסף מפתח Claude/OpenAI/Gemini להבנה אמיתית"}</div>
          </div>
        </div>
        <div className="row" style={{ gap: 24, marginBottom: 12 }}>
          <span>📄 הבוט קרא <strong>{seen}</strong> מילים</span>
          {r.rendered && <span>🖥️ בדפדפן מלא: <strong>{full}</strong> מילים</span>}
          {r.visibleRatio !== undefined && <span className={r.visibleRatio < 0.6 ? "error" : "ok"}>רואה {Math.round(r.visibleRatio * 100)}% מהדף</span>}
        </div>
        <p><strong>מה ה-AI הבין:</strong> {u.summary}</p>
        {u.mainEntity && <p className="muted">נושא מרכזי: {u.mainEntity} · קהל: {u.audience}</p>}
        {u.questionsAnswered.length > 0 && (<>
          <strong>שאלות שהדף עונה עליהן:</strong>
          <ul>{u.questionsAnswered.map((q) => <li key={q}>{q}</li>)}</ul>
        </>)}
        {u.unclear.length > 0 && (<>
          <strong className="error">לא ברור / חסר:</strong>
          <ul>{u.unclear.map((q) => <li key={q}>{q}</li>)}</ul>
        </>)}
        {r.notes.map((n) => <p key={n} className="error">⚠️ {n}</p>)}
        <details style={{ marginTop: 12 }}>
          <summary>הצג את כל הטקסט שהבוט קרא</summary>
          <pre dir="auto" style={{ whiteSpace: "pre-wrap", maxHeight: 400, overflow: "auto", background: "var(--bg)", padding: 12, borderRadius: 10 }}>{r.raw.text || "(ריק)"}</pre>
        </details>
      </div>
    </>
  );
}
