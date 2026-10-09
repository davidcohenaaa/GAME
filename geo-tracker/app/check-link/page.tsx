"use client";
import { useState } from "react";
import { ENGINES } from "@/lib/types";

interface Bot { bot: string; label: string; robots: string; fetchStatus: number | null; ok: boolean }
interface Result {
  url: string; finalUrl: string; status: number; noindex: boolean; title?: string; hasSchema: boolean;
  hasSitemap: boolean; bots: Bot[]; issues: string[]; citedBy: string[]; domainCited: boolean; hasRun: boolean; error?: string;
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
