import { createFileRoute } from "@tanstack/react-router";
import { Link2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { getComparisonData } from "@/lib/geo.functions";
import { computeBrandRows, type MetricsAnswer } from "@/lib/metrics";

export const Route = createFileRoute("/competitors")({
  head: () => ({
    meta: [
      { title: "מתחרים | GEO" },
      { name: "description", content: "רשימת המתחרים במעקב, כתובות האתרים ונתוני הנראות שלהם." },
      { property: "og:title", content: "מתחרים | GEO" },
      { property: "og:description", content: "רשימת המתחרים במעקב ונתוני הנראות שלהם." },
    ],
  }),
  loader: async () => {
    const data = await getComparisonData();
    return data;
  },
  component: CompetitorsPage,
});

function CompetitorsPage() {
  const { brands, answers } = Route.useLoaderData();
  const rows = computeBrandRows(brands, answers as unknown as MetricsAnswer[]);
  const aliasesById = new Map(brands.map((b) => [b.id, b.aliases]));
  const hasAnswers = answers.length > 0;

  return (
    <AppShell title="מתחרים" subtitle="המותגים שהמערכת עוקבת אחריהם בתשובות AI">
      {!hasAnswers ? (
        <div className="surface-card mb-6 p-4 text-center text-sm text-muted-foreground">
          עדיין לא נאספו תשובות – המדדים יתמלאו אחרי הסריקה הראשונה.
        </div>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        {rows.map((r) => (
          <div key={r.id} className="surface-card p-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="truncate text-base font-bold">{r.brand}</p>
              {r.isMine ? (
                <span className="shrink-0 rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                  המותג שלי
                </span>
              ) : null}
            </div>
            <p dir="ltr" className="mb-2 flex items-center gap-1.5 truncate text-xs text-muted-foreground">
              <Link2 className="h-3.5 w-3.5 shrink-0" />
              {r.url || "—"}
            </p>
            <p className="mb-4 truncate text-xs text-muted-foreground">
              שמות מזוהים: {(aliasesById.get(r.id) ?? []).join(" · ") || r.brand}
            </p>
            <div className="grid grid-cols-3 gap-2 text-center">
              <Metric label="אזכורים" value={hasAnswers ? `${r.mentionRate}%` : "—"} tone="text-success" />
              <Metric label="מיקום" value={r.avgPosition > 0 ? r.avgPosition.toFixed(1) : "—"} tone="text-primary" />
              <Metric label="קישורים" value={hasAnswers ? `${r.linkRate}%` : "—"} tone="text-brandpurple" />
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
