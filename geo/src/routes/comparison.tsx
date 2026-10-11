import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { HelpCircle, Lightbulb, X } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getComparisonData } from "@/lib/geo.functions";
import { DOMAINS, MY_BRAND, COMPARE_CRITERIA, ACTIONS } from "@/data/mock";

export const Route = createFileRoute("/comparison")({
  head: () => ({
    meta: [
      { title: "השוואה לפי תחום | GEO" },
      {
        name: "description",
        content: "דירוג משוקלל של המותג שלך מול המתחרים לפי תחום, כולל ניתוח למה מתחרה מקדים אותך.",
      },
      { property: "og:title", content: "השוואה לפי תחום | GEO" },
      { property: "og:description", content: "דירוג משוקלל מול המתחרים וניתוח פערים לפי עמוד." },
    ],
  }),
  loader: async () => {
    const data = await getComparisonData();
    return data;
  },
  component: ComparisonPage,
});

type ComparisonRow = {
  brand: string;
  isMine: boolean;
  avgPosition: number;
  mentionRate: number;
  linkRate: number;
  url: string;
};

function ComparisonPage() {
  const { brands, topics, answers } = Route.useLoaderData();
  const [domain, setDomain] = useState("all");
  const [openRival, setOpenRival] = useState<ComparisonRow | null>(null);
  const [myUrl, setMyUrl] = useState("https://mysite.co.il/travel-insurance");
  const [rivalUrl, setRivalUrl] = useState("");

  const myBrand = brands.find((b) => b.is_mine);
  const myBrandName = myBrand?.name ?? MY_BRAND;

  const rows = useMemo<ComparisonRow[]>(() => {
    const questionDomainMap = new Map<string, string>();
    for (const t of topics) {
      for (const q of (t as unknown as { questions?: { id: string }[] }).questions ?? []) {
        questionDomainMap.set(q.id, t.domain_id);
      }
    }

    const byBrand = new Map<
      string,
      { brand: string; isMine: boolean; url: string; positions: number[]; mentions: number; links: number; answered: number }
    >();

    for (const answer of answers as unknown as {
      question_id: string;
      questions: { topic_id: string; topics: { domain_id: string } | null } | null;
      answer_rankings: {
        brand_id: string;
        position: number | null;
        mentioned: boolean;
        has_link: boolean;
        brands: { id: string; name: string; is_mine: boolean; website_url: string | null } | null;
      }[];
    }[]) {
      const answerDomain = answer.questions?.topics?.domain_id ?? "all";
      if (domain !== "all" && answerDomain !== domain) continue;

      for (const r of answer.answer_rankings) {
        if (!r.brands) continue;
        const existing = byBrand.get(r.brands.id) ?? {
          brand: r.brands.name,
          isMine: r.brands.is_mine,
          url: r.brands.website_url ?? "",
          positions: [],
          mentions: 0,
          links: 0,
          answered: 0,
        };
        existing.answered += 1;
        if (r.mentioned) {
          existing.mentions += 1;
          if (r.position !== null) existing.positions.push(r.position);
          if (r.has_link) existing.links += 1;
        }
        byBrand.set(r.brands.id, existing);
      }
    }

    return Array.from(byBrand.values())
      .map((r) => ({
        brand: r.brand,
        isMine: r.isMine,
        url: r.url,
        avgPosition: r.positions.length > 0 ? r.positions.reduce((a, b) => a + b, 0) / r.positions.length : 0,
        mentionRate: r.answered > 0 ? Math.round((r.mentions / r.answered) * 100) : 0,
        linkRate: r.mentions > 0 ? Math.round((r.links / r.mentions) * 100) : 0,
      }))
      .sort((a, b) => {
        if (a.avgPosition === 0 && b.avgPosition === 0) return b.mentionRate - a.mentionRate;
        if (a.avgPosition === 0) return 1;
        if (b.avgPosition === 0) return -1;
        return a.avgPosition - b.avgPosition;
      });
  }, [answers, domain, topics]);

  const myIndex = rows.findIndex((r) => r.isMine);

  return (
    <AppShell title="השוואה לפי תחום" subtitle="דירוג משוקלל של המותג שלך מול המתחרים">
      <div className="mb-6 flex flex-wrap gap-2">
        {DOMAINS.map((d) => (
          <button
            key={d.id}
            onClick={() => {
              setDomain(d.id);
              setOpenRival(null);
            }}
            className={`rounded-full border px-4 py-1.5 text-sm transition-colors ${
              domain === d.id
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground hover:bg-secondary"
            }`}
          >
            {d.name}
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="surface-card p-6 text-center text-sm text-muted-foreground">
          אין עדיין נתונים להשוואה. הפעל סריקה ידנית כדי לקבל תוצאות אמיתיות.
        </div>
      ) : (
        <div className="surface-card mb-6 overflow-x-auto">
          <table className="w-full min-w-[680px] text-sm">
            <thead>
              <tr className="border-b border-border text-right text-xs text-muted-foreground">
                <th className="p-4 font-medium">#</th>
                <th className="p-4 font-medium">מותג</th>
                <th className="p-4 font-medium">מיקום ממוצע</th>
                <th className="p-4 font-medium">שיעור אזכורים</th>
                <th className="p-4 font-medium">שיעור קישורים</th>
                <th className="p-4 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr
                  key={r.brand}
                  className={`border-b border-border last:border-0 ${r.isMine ? "bg-primary/5" : ""}`}
                >
                  <td className="p-4 font-bold text-muted-foreground">{i + 1}</td>
                  <td className="p-4 font-semibold">
                    {r.brand}
                    {r.isMine ? <span className="mr-2 text-xs font-normal text-primary">(אני)</span> : null}
                  </td>
                  <td className="p-4 text-primary font-semibold">
                    {r.avgPosition > 0 ? r.avgPosition.toFixed(1) : "—"}
                  </td>
                  <td className="p-4">
                    <Bar value={r.mentionRate} color="var(--color-chart-2)" />
                  </td>
                  <td className="p-4">
                    <Bar value={r.linkRate} color="var(--color-chart-3)" />
                  </td>
                  <td className="p-4 text-left">
                    {!r.isMine && myIndex > -1 && i < myIndex ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setOpenRival(r);
                          setRivalUrl(r.url);
                        }}
                      >
                        <HelpCircle className="h-4 w-4" />
                        למה הוא לפניי?
                      </Button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {openRival ? (
        <div className="surface-card p-6">
          <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-lg font-black">
                למה {openRival.brand} מקדים את {myBrandName}?
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                השוואת העמוד שלך מול העמוד של המתחרה לפי הקריטריונים שמנועי AI מסתמכים עליהם
              </p>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setOpenRival(null)}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="mb-6 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                כתובת העמוד שלי
              </label>
              <Input value={myUrl} onChange={(e) => setMyUrl(e.target.value)} dir="ltr" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                כתובת העמוד של המתחרה
              </label>
              <Input value={rivalUrl} onChange={(e) => setRivalUrl(e.target.value)} dir="ltr" />
            </div>
          </div>

          <div className="space-y-4">
            {COMPARE_CRITERIA.map((c) => (
              <div key={c.label} className="rounded-xl border border-border p-4">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold">{c.label}</p>
                  <p className="text-xs text-muted-foreground">
                    אני {c.mine} · {openRival.brand} {c.rival}
                  </p>
                </div>
                <div className="mb-1.5 flex items-center gap-2">
                  <span className="w-10 shrink-0 text-xs text-muted-foreground">אני</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-secondary">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${c.mine}%` }} />
                  </div>
                </div>
                <div className="mb-2 flex items-center gap-2">
                  <span className="w-10 shrink-0 text-xs text-muted-foreground">מתחרה</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-secondary">
                    <div className="h-full rounded-full bg-brandpurple" style={{ width: `${c.rival}%` }} />
                  </div>
                </div>
                <p className="text-xs leading-6 text-muted-foreground">{c.note}</p>
              </div>
            ))}
          </div>

          <div className="mt-6 rounded-xl bg-secondary p-5">
            <h3 className="mb-3 flex items-center gap-2 text-base font-bold">
              <Lightbulb className="h-4.5 w-4.5 text-primary" />
              מה לשנות בעמוד שלי
            </h3>
            <ol className="space-y-2.5">
              {ACTIONS.map((a, i) => (
                <li key={a} className="flex gap-3 text-sm leading-6">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-primary text-xs font-bold text-primary-foreground">
                    {i + 1}
                  </span>
                  <span>{a}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}

function Bar({ value, color }: { value: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-20 overflow-hidden rounded-full bg-secondary">
        <div className="h-full rounded-full" style={{ width: `${value}%`, backgroundColor: color }} />
      </div>
      <span className="text-xs text-muted-foreground">{value}%</span>
    </div>
  );
}
