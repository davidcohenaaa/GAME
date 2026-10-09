"use client";
import { useEffect, useState } from "react";
import { ENGINES, type Competitor } from "@/lib/types";

const KEY_FIELDS = [
  ["openai", "OpenAI (ChatGPT)"], ["perplexity", "Perplexity"], ["gemini", "Gemini"],
  ["anthropic", "Anthropic (Claude)"], ["apify", "Apify (Google AI Overview + AI Mode)"],
] as const;

export default function Settings() {
  const [brand, setBrand] = useState("");
  const [domain, setDomain] = useState("");
  const [comps, setComps] = useState<Competitor[]>([]);
  const [prompts, setPrompts] = useState("");
  const [demo, setDemo] = useState(false);
  const [keys, setKeys] = useState<Record<string, string>>({});
  const [keysSet, setKeysSet] = useState<Record<string, boolean>>({});
  const [engines, setEngines] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);

  function apply(s: any) {
    setBrand(s.brand); setDomain(s.domain); setComps(s.competitors); setPrompts(s.prompts.join("\n"));
    setDemo(s.demo); setKeysSet(s.keysSet); setEngines(s.engines);
  }
  useEffect(() => { fetch("/api/settings").then((r) => r.json()).then(apply); }, []);

  async function save() {
    const r = await fetch("/api/settings", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ brand, domain, competitors: comps, prompts: prompts.split("\n"), demo, keys }),
    });
    apply(await r.json()); setKeys({}); setSaved(true); setTimeout(() => setSaved(false), 2500);
  }

  const setComp = (i: number, patch: Partial<Competitor>) => setComps(comps.map((c, j) => (j === i ? { ...c, ...patch } : c)));

  return (
    <>
      <h1>הגדרות</h1>
      <div className="card">
        <h2 style={{ marginTop: 0 }}>1. האתר שלי</h2>
        <label>שם המותג</label><input value={brand} onChange={(e) => setBrand(e.target.value)} />
        <label>דומיין</label><input dir="ltr" placeholder="example.com" value={domain} onChange={(e) => setDomain(e.target.value)} />

        <h2>2. מתחרים (עד 5)</h2>
        {comps.map((c, i) => (
          <div key={i} className="row" style={{ marginBottom: 8 }}>
            <input style={{ flex: 1 }} placeholder="שם" value={c.name} onChange={(e) => setComp(i, { name: e.target.value })} />
            <input style={{ flex: 1 }} dir="ltr" placeholder="competitor.com" value={c.domain} onChange={(e) => setComp(i, { domain: e.target.value })} />
            <button className="ghost" onClick={() => setComps(comps.filter((_, j) => j !== i))}>✕</button>
          </div>
        ))}
        {comps.length < 5 && <button className="ghost" onClick={() => setComps([...comps, { name: "", domain: "" }])}>+ הוסף מתחרה</button>}

        <h2>3. פרומפטים (אחד בכל שורה)</h2>
        <textarea rows={6} value={prompts} onChange={(e) => setPrompts(e.target.value)} placeholder="מהי התוכנה הטובה ביותר ל…?" />

        <h2>4. מפתחות API</h2>
        <p className="muted">נשמרים בשרת בלבד. מנוע בלי מפתח פשוט לא ירוץ.</p>
        {KEY_FIELDS.map(([k, name]) => (
          <div key={k}>
            <label>{name} {keysSet[k] && <span className="ok">✓ מוגדר</span>}</label>
            <input dir="ltr" type="password" placeholder={keysSet[k] ? "•••••••• (השאר ריק לשמירה)" : "הדבק מפתח"} value={keys[k] ?? ""} onChange={(e) => setKeys({ ...keys, [k]: e.target.value })} />
          </div>
        ))}
        <label style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 20 }}>
          <input type="checkbox" style={{ width: "auto" }} checked={demo} onChange={(e) => setDemo(e.target.checked)} />
          מצב הדגמה (תשובות מדומות, בלי מפתחות)
        </label>

        <div className="row" style={{ marginTop: 20 }}>
          <button onClick={save}>שמור</button>
          {saved && <span className="ok">נשמר ✓</span>}
          <span className="muted">מנועים פעילים: {engines.map((e) => ENGINES.find((x) => x.id === e)?.label).join(", ") || "אין"}</span>
        </div>
      </div>
    </>
  );
}
