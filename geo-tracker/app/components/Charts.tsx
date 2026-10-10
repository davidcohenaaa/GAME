import { ENGINES, type RunResult } from "@/lib/types";

export const toneOf = (n: number) => (n >= 60 ? "good" : n >= 30 ? "warn" : "bad");

/** Circular progress for the 0-100 visibility score. */
export function ScoreRing({ value }: { value: number }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  return (
    <div className={`ring ${toneOf(value)}`} role="img" aria-label={`ציון נראות ${value} מתוך 100`}>
      <svg viewBox="0 0 120 120" width="140" height="140" aria-hidden="true">
        <circle cx="60" cy="60" r={r} fill="none" stroke="var(--track)" strokeWidth="12" />
        <circle
          cx="60" cy="60" r={r} fill="none" stroke="currentColor" strokeWidth="12" strokeLinecap="round"
          strokeDasharray={`${(c * value) / 100} ${c}`} transform="rotate(-90 60 60)"
        />
      </svg>
      <span className="ring-num">{value}</span>
    </div>
  );
}

/** Stacked bar per engine: linked / mentioned only / absent, over the prompts that engine answered. */
export function EngineCoverage({ run }: { run: RunResult }) {
  const rows = run.engines.map((id) => {
    const cells = run.cells.filter((c) => c.engine === id && c.status === "ok");
    const linked = cells.filter((c) => c.me.linked).length;
    const mentioned = cells.filter((c) => c.me.mentioned && !c.me.linked).length;
    return { id, label: ENGINES.find((e) => e.id === id)?.label ?? id, total: cells.length, linked, mentioned };
  });
  return (
    <div className="card">
      <div className="legend">
        <span><i className="sw link" /> לינק לאתר</span>
        <span><i className="sw mention" /> אזכור בשם</span>
        <span><i className="sw none" /> לא מופיע</span>
      </div>
      <div className="engines">
        {rows.map((r) => (
          <div key={r.id} className="eng">
            <span className="eng-name">{r.label}</span>
            <div className="stack" role="img" aria-label={`${r.label}: ${r.linked} לינק, ${r.mentioned} אזכור, מתוך ${r.total}`}>
              {r.total === 0 ? null : (
                <>
                  <div className="seg link" style={{ width: `${(r.linked / r.total) * 100}%` }} />
                  <div className="seg mention" style={{ width: `${(r.mentioned / r.total) * 100}%` }} />
                </>
              )}
            </div>
            <span className="eng-n">{r.linked + r.mentioned}/{r.total}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
