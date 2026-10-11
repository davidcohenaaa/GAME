import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AppShell } from "@/components/AppShell";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getDashboardData } from "@/lib/geo.functions";
import { DOMAINS, domainName } from "@/lib/catalog";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "לוח בקרה | GEO – נראות מותג בתשובות AI" },
      {
        name: "description",
        content: "מדדי נראות המותג שלך בתשובות של מנועי AI: אזכורים, מיקום ממוצע ומגמה לאורך זמן.",
      },
      { property: "og:title", content: "לוח בקרה | GEO" },
      {
        property: "og:description",
        content: "מדדי נראות המותג שלך בתשובות של מנועי AI במבט אחד.",
      },
    ],
  }),
  loader: async () => {
    const data = await getDashboardData();
    return data;
  },
  component: Dashboard,
});

function Kpi({ label, value, hint, tone }: { label: string; value: string; hint: string; tone: string }) {
  return (
    <div className="surface-card p-5">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={`mt-2 text-3xl font-black tracking-tight ${tone}`}>{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

function Dashboard() {
  const data = Route.useLoaderData();
  const [domain, setDomain] = useState("all");
  const [range, setRange] = useState("90");

  const myBrandName = data.myBrand?.name ?? "המותג שלי";
  const hasData = data.metrics.questionCount > 0;

  const trend = useMemo(() => {
    const from = new Date(Date.now() - Number(range) * 86400000).toISOString().slice(0, 10);
    return data.trend.filter((t) => t.date >= from && t.position > 0);
  }, [data.trend, range]);

  const breakdown = useMemo(() => {
    if (domain === "all") {
      return data.metrics.domainBreakdown
        .filter((d) => d.domainId !== "all")
        .map((d) => ({
          domain: domainName(d.domainId),
          rate: d.rate,
        }));
    }
    const item = data.metrics.domainBreakdown.find((d) => d.domainId === domain);
    return item
      ? [{ domain: domainName(domain), rate: item.rate }]
      : [];
  }, [data.metrics.domainBreakdown, domain]);

  const scoped = data.metrics.domainBreakdown.find((d) => d.domainId === domain);

  return (
    <AppShell
      title="לוח בקרה"
      subtitle={`איך ${myBrandName} נראית בתשובות של מנועי AI – מבט מהיר`}
    >
      <div className="surface-card mb-6 grid gap-3 p-4 sm:grid-cols-2">
        <Filter label="נושא / תחום" value={domain} onChange={setDomain}
          options={DOMAINS.map((d) => ({ value: d.id, label: d.name }))} />
        <Filter label="טווח זמן" value={range} onChange={setRange}
          options={[
            { value: "30", label: "30 ימים אחרונים" },
            { value: "90", label: "90 ימים אחרונים" },
            { value: "180", label: "6 חודשים אחרונים" },
          ]} />
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="נושאים במעקב" value={String(data.metrics.topicCount)} hint="פעילים כרגע" tone="text-foreground" />
        <Kpi label="שאלות במעקב" value={String(data.metrics.questionCount)} hint="נשאלות בכל סריקה" tone="text-foreground" />
        <Kpi label="ממוצע אזכורים" value={scoped ? `${scoped.rate}%` : "—"}
          hint={domain === "all" ? `מתוך ${data.metrics.answerCount} תשובות שנאספו` : domainName(domain)} tone="text-success" />
        <Kpi label="מיקום ממוצע" value={scoped?.avgPosition ? scoped.avgPosition.toFixed(1) : "—"}
          hint="בתשובות שבהן הוזכרת" tone="text-primary" />
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="surface-card p-5 lg:col-span-3">
          <h2 className="text-base font-bold">מיקום ממוצע לאורך זמן</h2>
          <p className="mb-4 text-xs text-muted-foreground">ככל שהקו יורד – אתה מדורג גבוהה יותר</p>
          <div className="h-64" dir="ltr">
            {trend.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="pos" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-chart-1)" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="var(--color-chart-1)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                  <XAxis dataKey="date" tickLine={false} axisLine={false} fontSize={12}
                    stroke="var(--color-muted-foreground)" />
                  <YAxis reversed domain={[1, "dataMax"]} allowDecimals={false} tickLine={false} axisLine={false} fontSize={12}
                    stroke="var(--color-muted-foreground)" width={28} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 12,
                      border: "1px solid var(--color-border)",
                      background: "var(--color-card)",
                      fontSize: 13,
                    }}
                    formatter={(v: number) => [v, "מיקום ממוצע"]}
                  />
                  <Area type="monotone" dataKey="position" stroke="var(--color-chart-1)" strokeWidth={3}
                    fill="url(#pos)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                אין עדיין נתונים – הפעל סריקה ראשונה
              </div>
            )}
          </div>
        </div>

        <div className="surface-card p-5 lg:col-span-2">
          <h2 className="text-base font-bold">חלוקה לפי תחומים</h2>
          <p className="mb-5 text-xs text-muted-foreground">שיעור התשובות שבהן אתה מוזכר</p>
          <div className="space-y-4">
            {breakdown.length > 0 ? (
              breakdown.map((d, i) => (
                <div key={d.domain}>
                  <div className="mb-1.5 flex items-center justify-between text-sm">
                    <span className="font-medium">{d.domain}</span>
                    <span className="text-muted-foreground">{d.rate}%</span>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.min(d.rate, 100)}%`,
                        backgroundColor: `var(--color-chart-${(i % 3) + 1})`,
                      }}
                    />
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">אין עדיין נתונים – הפעל סריקה ראשונה</p>
            )}
          </div>
        </div>
      </div>

      {!hasData && (
        <div className="mt-6 rounded-2xl border border-dashed border-border bg-card p-6 text-center">
          <p className="text-sm text-muted-foreground">
            המערכת מוכנה. כדי לראות נתונים אמיתיים, הפעל סריקה ידנית דרך ההגדרות או המתן לסריקה היומית.
          </p>
        </div>
      )}
    </AppShell>
  );
}

export function Filter({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}</label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
