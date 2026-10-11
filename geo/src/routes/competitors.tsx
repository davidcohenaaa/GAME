import { createFileRoute } from "@tanstack/react-router";
import { Link2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { RANKING } from "@/data/mock";

export const Route = createFileRoute("/competitors")({
  head: () => ({
    meta: [
      { title: "מתחרים | GEO" },
      { name: "description", content: "רשימת המתחרים במעקב, כתובות העמודים ונתוני הנראות שלהם." },
      { property: "og:title", content: "מתחרים | GEO" },
      { property: "og:description", content: "רשימת המתחרים במעקב ונתוני הנראות שלהם." },
    ],
  }),
  component: CompetitorsPage,
});

function CompetitorsPage() {
  const rows = RANKING["all"] ?? [];
  return (
    <AppShell title="מתחרים" subtitle="המותגים שהמערכת עוקבת אחריהם בתשובות AI">
      <div className="grid gap-4 sm:grid-cols-2">
        {rows.map((r) => (
          <div key={r.brand} className="surface-card p-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="truncate text-base font-bold">{r.brand}</p>
              {r.isMine ? (
                <span className="shrink-0 rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                  המותג שלי
                </span>
              ) : null}
            </div>
            <p dir="ltr" className="mb-4 flex items-center gap-1.5 truncate text-xs text-muted-foreground">
              <Link2 className="h-3.5 w-3.5 shrink-0" />
              {r.url}
            </p>
            <div className="grid grid-cols-3 gap-2 text-center">
              <Metric label="מיקום" value={r.avgPosition.toFixed(1)} tone="text-primary" />
              <Metric label="אזכורים" value={`${r.mentionRate}%`} tone="text-success" />
              <Metric label="קישורים" value={`${r.linkRate}%`} tone="text-brandpurple" />
            </div>
          </div>
        ))}
      </div>
    </AppShell>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="rounded-xl bg-secondary p-3">
      <p className={`text-lg font-bold ${tone}`}>{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
