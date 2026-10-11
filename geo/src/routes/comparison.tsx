import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { HelpCircle, Lightbulb, X } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { getComparisonData } from "@/lib/geo.functions";
import { DOMAINS, sourceName } from "@/lib/catalog";
import { answersInDomain, computeBrandRows, type BrandRow, type MetricsAnswer } from "@/lib/metrics";

export const Route = createFileRoute("/comparison")({
  head: () => ({
    meta: [
      { title: "השוואה לפי תחום | GEO" },
      {
        name: "description",
        content: "דירוג המותג שלך מול המתחרים לפי תחום, כולל השאלות שבהן מתחרה מקדים אותך.",
      },
      { property: "og:title", content: "השוואה לפי תחום | GEO" },
      { property: "og:description", content: "דירוג מול המתחרים והשאלות שבהן מתחרה מקדים אותך." },
    ],
  }),
  loader: async () => {
    const data = await getComparisonData();
    return data;
  },
  component: ComparisonPage,
});

// General GEO practices; they are not derived from a specific page analysis.
const GENERAL_TIPS = [
  "הוסף מקטע שאלות ותשובות בניסוח טבעי, כפי שגולשים שואלים את מנועי ה-AI.",
  "חלק את התוכן לכותרות H2/H3 לפי תת-נושאים ברורים.",
  "הוסף טבלאות ונתונים מדויקים – מודלי AI מצטטים נתונים מובנים.",
  "שמור על תאריך עדכון ודוגמאות עדכניות לשנה הנוכחית.",
  "התאם את כותרת העמוד לניסוח השאלה הנפוצה.",
];

type Loss = { questionId: string; question: string; source: string; mine: number | null; rival: number };

function ComparisonPage() {
  const { brands, answers } = Route.useLoaderData();
  const [domain, setDomain] = useState("all");
  const [openRival, setOpenRival] = useState<BrandRow | null>(null);

  const typedAnswers = answers as unknown as MetricsAnswer[];
  const myBrand = brands.find((b) => b.is_mine);
  const myBrandName = myBrand?.name ?? "המותג שלי";

  const rows = useMemo(() => computeBrandRows(brands, typedAnswers, domain), [brands, typedAnswers, domain]);
  const hasAnswers = answersInDomain(typedAnswers, domain).length > 0;
  const myIndex = rows.findIndex((r) => r.isMine);

  // Answers in scope where the rival is ranked above my brand (or I'm not mentioned at all)
  const losses = useMemo<Loss[]>(() => {
    if (!openRival || !myBrand) return [];
    return answersInDomain(typedAnswers, domain).flatMap((a) => {
      const rival = a.answer_rankings.find((r) => r.brand_id === openRival.id);
      const mine = a.answer_rankings.find((r) => r.brand_id === myBrand.id);
      if (!rival?.mentioned || rival.position === null) return [];
      const minePos = mine?.mentioned ? mine.position : null;
      if (minePos !== null && minePos < rival.position) return [];
      return [
        {
          questionId: a.question_id,
          question: a.questions?.text ?? "",
          source: a.source,
          mine: minePos,
          rival: rival.position,
        },
      ];
    });
  }, [openRival, myBrand, typedAnswers, domain]);

  return (
    <AppShell title="השוואה לפי תחום" subtitle="דירוג המותג שלך מול המתחרים">
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

      {!hasAnswers ? (
        <div className="surface-card p-6 text-center text-sm text-muted-foreground">
          אין עדיין נתונים להשוואה בתחום הזה. הפעל סריקה ידנית כדי לקבל תוצאות אמיתיות.
        </div>
      ) : (
        <div className="surface-card mb-6 overflow-x-auto">
          <table className="w-full min-w-[680px] text-sm">
            <thead>
              <tr className="border-b border-border text-right text-xs text-muted-foreground">
                <th className="p-4 font-medium">#</th>
                <th className="p-4 font-medium">מותג</th>
                <th className="p-4 font-medium">שיעור אזכורים</th>
                <th className="p-4 font-medium">מיקום ממוצע</th>
                <th className="p-4 font-medium">שיעור קישורים</th>
                <th className="p-4 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr
                  key={r.id}
                  className={`border-b border-border last:border-0 ${r.isMine ? "bg-primary/5" : ""}`}
                >
                  <td className="p-4 font-bold text-muted-foreground">{i + 1}</td>
                  <td className="p-4 font-semibold">
                    {r.brand}
                    {r.isMine ? <span className="mr-2 text-xs font-normal text-primary">(אני)</span> : null}
                  </td>
                  <td className="p-4">
                    <Bar value={r.mentionRate} color="var(--color-chart-2)" />
                  </td>
                  <td className="p-4 text-primary font-semibold">
                    {r.avgPosition > 0 ? r.avgPosition.toFixed(1) : "—"}
                  </td>
                  <td className="p-4">
                    <Bar value={r.linkRate} color="var(--color-chart-3)" />
                  </td>
                  <td className="p-4 text-left">
                    {!r.isMine && myIndex > -1 && i < myIndex ? (
                      <Button size="sm" variant="outline" onClick={() => setOpenRival(r)}>
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
                איפה {openRival.brand} מקדים את {myBrandName}?
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                התשובות שבהן {openRival.brand} דורג מעליך או שאתה לא הוזכרת בכלל
              </p>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setOpenRival(null)}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          {losses.length > 0 ? (
            <ul className="space-y-2">
              {losses.map((l) => (
                <li
                  key={`${l.questionId}-${l.source}`}
                  className="flex flex-wrap items-center gap-3 rounded-xl border border-border p-3.5 text-sm"
                >
                  <Link
                    to="/answers/$questionId"
                    params={{ questionId: l.questionId }}
                    className="min-w-0 flex-1 truncate font-medium hover:text-primary"
                  >
                    {l.question}
                  </Link>
                  <span className="shrink-0 rounded-lg bg-secondary px-2.5 py-1 text-xs text-muted-foreground">
                    {sourceName(l.source)}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {openRival.brand}: מקום {l.rival} · אני: {l.mine ? `מקום ${l.mine}` : "לא הוזכרתי"}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">לא נמצאו תשובות כאלה בתחום הנבחר.</p>
          )}

          <div className="mt-6 rounded-xl bg-secondary p-5">
            <h3 className="mb-3 flex items-center gap-2 text-base font-bold">
              <Lightbulb className="h-4.5 w-4.5 text-primary" />
              המלצות כלליות לשיפור נראות בתשובות AI
            </h3>
            <ol className="space-y-2.5">
              {GENERAL_TIPS.map((a, i) => (
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
