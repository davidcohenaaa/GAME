import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, Link2, XCircle } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { getAnswerDetail } from "@/lib/geo.functions";
import { SOURCES, type SourceId } from "@/data/mock";

export const Route = createFileRoute("/answers/$questionId")({
  loader: async ({ params }) => {
    const data = await getAnswerDetail({ data: { questionId: params.questionId } });
    if (!data.question) throw notFound();
    return data;
  },
  head: ({ loaderData }) => {
    if (!loaderData?.question) {
      return { meta: [{ title: "תשובה לא נמצאה | GEO" }, { name: "robots", content: "noindex" }] };
    }
    const q = loaderData.question as { text: string };
    return {
      meta: [
        { title: `${q.text} | GEO` },
        { name: "description", content: `תוצאת ניתוח AI עבור השאלה: ${q.text}` },
        { property: "og:title", content: `${q.text} | GEO` },
        { property: "og:description", content: "תוצאה משוקללת מכל מקורות ה-AI." },
      ],
    };
  },
  component: AnswerPage,
});

function AnswerPage() {
  const { question, sourceAnswers, allBrands } = Route.useLoaderData();
  const [source, setSource] = useState<"all" | SourceId>("all");

  const q = question as { id: string; text: string; topics: { name: string; domain_id: string } | null };
  const topicName = q.topics?.name ?? "";

  const visibleAnswers = useMemo(() => {
    if (source === "all") return sourceAnswers;
    return sourceAnswers.filter((a) => a.source === source);
  }, [sourceAnswers, source]);

  const myBrand = allBrands.find((b) => b.is_mine);

  const combinedRanking = useMemo(() => {
    const scores = new Map<
      string,
      { brand: string; isMine: boolean; mentions: number; positions: number[]; links: number; sources: SourceId[] }
    >();

    for (const answer of sourceAnswers) {
      for (const r of answer.answer_rankings) {
        if (!r.brands) continue;
        const existing = scores.get(r.brands.id);
        const sourceId = answer.source as SourceId;
        if (existing) {
          existing.mentions += r.mentioned ? 1 : 0;
          if (r.position !== null) existing.positions.push(r.position);
          if (r.has_link) existing.links += 1;
          if (!existing.sources.includes(sourceId)) existing.sources.push(sourceId);
        } else {
          scores.set(r.brands.id, {
            brand: r.brands.name,
            isMine: r.brands.is_mine,
            mentions: r.mentioned ? 1 : 0,
            positions: r.position !== null ? [r.position] : [],
            links: r.has_link ? 1 : 0,
            sources: [sourceId],
          });
        }
      }
    }

    return Array.from(scores.values())
      .map((r) => ({
        ...r,
        avgPosition: r.positions.length > 0 ? r.positions.reduce((a, b) => a + b, 0) / r.positions.length : null,
      }))
      .sort((a, b) => {
        if (a.avgPosition === null) return 1;
        if (b.avgPosition === null) return -1;
        return a.avgPosition - b.avgPosition;
      });
  }, [sourceAnswers]);

  const myRow = combinedRanking.find((r) => r.isMine);
  const myPosition = myRow ? combinedRanking.indexOf(myRow) + 1 : null;

  return (
    <AppShell title="תוצאת שאלה" subtitle={topicName}>
      <Button asChild variant="ghost" size="sm" className="mb-4 -mr-2">
        <Link to="/answers">
          <ArrowRight className="h-4 w-4" />
          חזרה לרשימת התשובות
        </Link>
      </Button>

      <div className="surface-card mb-6 p-6">
        <h2 className="text-xl font-black leading-snug">{q.text}</h2>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {[{ id: "all", name: "כל המקורות" }, ...SOURCES].map((s) => (
          <button
            key={s.id}
            onClick={() => setSource(s.id as "all" | SourceId)}
            className={`rounded-full border px-4 py-1.5 text-sm transition-colors ${
              source === s.id
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground hover:bg-secondary"
            }`}
          >
            {s.name}
          </button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-3">
          {source === "all" ? (
            <div className="surface-card p-6">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-base font-bold">תשובה משוקללת מכל המקורות</h3>
                <span className="rounded-lg bg-brandpurple/10 px-2.5 py-1 text-xs font-medium text-brandpurple">
                  {sourceAnswers.length} מקורות
                </span>
              </div>
              {sourceAnswers.length > 0 ? (
                <div className="space-y-4">
                  {sourceAnswers.map((a) => (
                    <div key={a.id} className="rounded-xl border border-border p-4">
                      <p className="mb-1 text-xs font-semibold text-primary">{a.source}</p>
                      <p className="text-sm leading-7 text-muted-foreground">{a.summary}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">אין עדיין תשובות עבור שאלה זו.</p>
              )}
            </div>
          ) : (
            visibleAnswers.map((a) => (
              <div key={a.id} className="surface-card p-6">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-base font-bold">{SOURCES.find((s) => s.id === a.source)?.name ?? a.source}</h3>
                </div>
                <p className="text-sm leading-7 text-muted-foreground">{a.summary}</p>
              </div>
            ))
          )}

          <div className="grid gap-4 sm:grid-cols-3">
            <Verdict
              label="האם המותג שלי הוזכר"
              value={myRow ? "כן" : "לא"}
              ok={Boolean(myRow)}
            />
            <Verdict
              label="באיזה מקום"
              value={myPosition ? `מקום ${myPosition}` : "—"}
              ok={Boolean(myPosition && myPosition <= 3)}
            />
            <Verdict
              label="קישור לאתר שלי"
              value={myRow && myRow.links > 0 ? "קיים" : "אין"}
              ok={Boolean(myRow && myRow.links > 0)}
            />
          </div>

          <div className="surface-card p-6">
            <h3 className="mb-3 text-base font-bold">מתחרים שהוזכרו</h3>
            <div className="flex flex-wrap gap-2">
              {combinedRanking
                .filter((r) => !r.isMine)
                .map((r) => (
                  <span
                    key={r.brand}
                    className="rounded-full bg-secondary px-3.5 py-1.5 text-sm text-secondary-foreground"
                  >
                    {r.brand}
                  </span>
                ))}
              {combinedRanking.filter((r) => !r.isMine).length === 0 ? (
                <p className="text-sm text-muted-foreground">לא הוזכרו מתחרים במקורות הללו.</p>
              ) : null}
            </div>
          </div>
        </div>

        <div className="surface-card p-6 lg:col-span-2">
          <h3 className="mb-1 text-base font-bold">דירוג מותגים</h3>
          <p className="mb-4 text-xs text-muted-foreground">לפי סדר ההופעה המשוקלל</p>
          <ol className="space-y-2.5">
            {combinedRanking.map((r, i) => (
              <li
                key={r.brand}
                className={`flex items-center gap-3 rounded-xl border p-3 ${
                  r.isMine ? "border-primary bg-primary/5" : "border-border bg-card"
                }`}
              >
                <span
                  className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg text-sm font-bold ${
                    r.isMine ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"
                  }`}
                >
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium">
                  {r.brand}
                  {r.isMine ? <span className="mr-2 text-xs text-primary">(המותג שלי)</span> : null}
                </span>
                {r.links > 0 ? (
                  <Link2 className="h-4 w-4 shrink-0 text-primary" />
                ) : (
                  <span className="shrink-0 text-xs text-muted-foreground">ללא לינק</span>
                )}
              </li>
            ))}
          </ol>
        </div>
      </div>
    </AppShell>
  );
}

function Verdict({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div className="surface-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="mt-1.5 flex items-center gap-2">
        {ok ? (
          <CheckCircle2 className="h-4.5 w-4.5 text-success" />
        ) : (
          <XCircle className="h-4.5 w-4.5 text-muted-foreground" />
        )}
        <span className={`text-lg font-bold ${ok ? "text-success" : "text-foreground"}`}>{value}</span>
      </div>
    </div>
  );
}
