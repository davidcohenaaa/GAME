import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, CheckCircle2, Link2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { getAnswers } from "@/lib/geo.functions";

export const Route = createFileRoute("/answers/")({
  head: () => ({
    meta: [
      { title: "תשובות AI | GEO" },
      { name: "description", content: "רשימת התשובות שנאספו ממנועי AI עבור השאלות שבמעקב." },
      { property: "og:title", content: "תשובות AI | GEO" },
      { property: "og:description", content: "רשימת התשובות שנאספו ממנועי AI עבור השאלות שבמעקב." },
    ],
  }),
  loader: async () => {
    const answers = await getAnswers();
    return { answers };
  },
  component: AnswersList,
});

function AnswersList() {
  const { answers } = Route.useLoaderData();

  return (
    <AppShell title="תשובות" subtitle="תוצאות משוקללות מכל מקורות ה-AI עבור השאלות שבמעקב">
      <div className="space-y-3">
        {answers.length === 0 ? (
          <div className="surface-card p-6 text-center text-sm text-muted-foreground">
            אין עדיין תשובות שנאספו. הפעל סריקה ידנית כדי לקבל נתונים אמיתיים.
          </div>
        ) : (
          answers.map((a) => {
            const question = a.questions as { text: string; topics: { name: string } | null } | null;
            const topicName = question?.topics?.name ?? "";
            return (
              <Link
                key={a.id}
                to="/answers/$questionId"
                params={{ questionId: a.question_id }}
                className="surface-card flex flex-wrap items-center gap-4 p-5 transition-colors hover:bg-secondary/50"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-bold">{question?.text ?? "שאלה"}</p>
                  <p className="text-xs text-muted-foreground">{topicName}</p>
                </div>
                <span className="flex shrink-0 items-center gap-1.5 rounded-lg bg-success/10 px-2.5 py-1 text-xs font-medium text-success">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {a.source}
                </span>
                <ArrowLeft className="h-4 w-4 shrink-0 text-muted-foreground" />
              </Link>
            );
          })
        )}
      </div>
    </AppShell>
  );
}
