import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ChevronDown, Plus, Link2, CheckCircle2, MinusCircle, Loader2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DOMAINS } from "@/data/mock";
import { addQuestion, addTopic, getTopics } from "@/lib/geo.functions";
import { useServerFn } from "@tanstack/react-start";

export const Route = createFileRoute("/topics")({
  head: () => ({
    meta: [
      { title: "נושאים ושאלות | GEO" },
      {
        name: "description",
        content: "ניהול נושאים ושאלות במעקב, אחוז הופעה ומיקום ממוצע לכל נושא.",
      },
      { property: "og:title", content: "נושאים ושאלות | GEO" },
      { property: "og:description", content: "ניהול נושאים ושאלות במעקב עם אחוז הופעה ומיקום ממוצע." },
    ],
  }),
  loader: async () => {
    const data = await getTopics();
    return data;
  },
  component: TopicsPage,
});

type TopicItem = Awaited<ReturnType<typeof getTopics>>["topics"][number];
type QuestionItem = TopicItem["questions"][number];

function TopicsPage() {
  const initial = Route.useLoaderData();
  const [topics, setTopics] = useState<TopicItem[]>(initial.topics);
  const [domain, setDomain] = useState("all");
  const [open, setOpen] = useState<string | null>(initial.topics[0]?.id ?? null);
  const [newTopic, setNewTopic] = useState("");
  const [newTopicDomain, setNewTopicDomain] = useState("travel");
  const [topicDialog, setTopicDialog] = useState(false);
  const [questionFor, setQuestionFor] = useState<string | null>(null);
  const [newQuestion, setNewQuestion] = useState("");
  const [saving, setSaving] = useState(false);

  const addTopicFn = useServerFn(addTopic);
  const addQuestionFn = useServerFn(addQuestion);

  const filtered = useMemo(
    () => (domain === "all" ? topics : topics.filter((t) => t.domain_id === domain)),
    [topics, domain],
  );

  async function handleAddTopic() {
    if (!newTopic.trim()) return;
    setSaving(true);
    try {
      const topic = await addTopicFn({ data: { name: newTopic.trim(), domainId: newTopicDomain } });
      setTopics((prev) => [
        ...prev,
        {
          ...topic,
          appearanceRate: 0,
          avgPosition: 0,
          questions: [],
        },
      ]);
      setNewTopic("");
      setTopicDialog(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleAddQuestion() {
    if (!newQuestion.trim() || !questionFor) return;
    setSaving(true);
    try {
      const question = await addQuestionFn({
        data: { topicId: questionFor, text: newQuestion.trim() },
      });
      const topic = topics.find((t) => t.id === questionFor);
      const enriched: QuestionItem = {
        ...question,
        topics: topic ? { id: topic.id, name: topic.name, domain_id: topic.domain_id } : { id: "", name: "", domain_id: "" },
        mentioned: false,
        position: null,
        hasLink: false,
        answerCount: 0,
      };
      setTopics((prev) =>
        prev.map((t) =>
          t.id === questionFor ? { ...t, questions: [...t.questions, enriched] } : t,
        ),
      );
      setNewQuestion("");
      setQuestionFor(null);
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell title="נושאים ושאלות" subtitle="הגדר את הנושאים והשאלות שהמערכת עוקבת אחריהן">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {DOMAINS.map((d) => (
            <button
              key={d.id}
              onClick={() => setDomain(d.id)}
              className={`rounded-full border px-4 py-1.5 text-sm transition-colors ${
                domain === d.id
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground hover:bg-secondary"
              }`}
            >
              {d.id === "all" ? "הכל" : d.name}
            </button>
          ))}
        </div>

        <Dialog open={topicDialog} onOpenChange={setTopicDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4" />
              הוסף נושא
            </Button>
          </DialogTrigger>
          <DialogContent dir="rtl">
            <DialogHeader className="text-right">
              <DialogTitle>נושא חדש</DialogTitle>
              <DialogDescription>לדוגמה: ביטוח נסיעות, מחירים, שירות, בריאות</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <Input
                placeholder="שם הנושא"
                value={newTopic}
                onChange={(e) => setNewTopic(e.target.value)}
              />
              <Select value={newTopicDomain} onValueChange={setNewTopicDomain}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DOMAINS.filter((d) => d.id !== "all").map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button onClick={handleAddTopic} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                שמור נושא
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-4">
        {filtered.map((topic) => {
          const isOpen = open === topic.id;
          return (
            <div key={topic.id} className="surface-card overflow-hidden">
              <button
                onClick={() => setOpen(isOpen ? null : topic.id)}
                className="flex w-full items-center gap-4 p-5 text-right transition-colors hover:bg-secondary/60"
              >
                <ChevronDown
                  className={`h-5 w-5 shrink-0 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-bold">{topic.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {DOMAINS.find((d) => d.id === topic.domain_id)?.name}
                  </p>
                </div>
                <div className="hidden gap-8 sm:flex">
                  <Stat label="שאלות" value={String(topic.questions.length)} />
                  <Stat label="אחוז הופעה" value={`${topic.appearanceRate}%`} tone="text-success" />
                  <Stat
                    label="מיקום ממוצע"
                    value={topic.avgPosition ? topic.avgPosition.toFixed(1) : "—"}
                    tone="text-primary"
                  />
                </div>
              </button>

              {isOpen ? (
                <div className="border-t border-border bg-secondary/40 px-5 py-4">
                  <ul className="space-y-2">
                    {topic.questions.map((q: typeof topic.questions[number]) => (
                      <li
                        key={q.id}
                        className="flex flex-wrap items-center gap-3 rounded-xl bg-card p-3.5 shadow-[var(--shadow-soft)]"
                      >
                        {q.mentioned ? (
                          <CheckCircle2 className="h-4.5 w-4.5 shrink-0 text-success" />
                        ) : (
                          <MinusCircle className="h-4.5 w-4.5 shrink-0 text-muted-foreground" />
                        )}
                        <span className="min-w-0 flex-1 truncate text-sm">{q.text}</span>
                        {q.hasLink ? <Link2 className="h-4 w-4 shrink-0 text-primary" /> : null}
                        <span className="shrink-0 rounded-lg bg-secondary px-2.5 py-1 text-xs text-muted-foreground">
                          {q.position ? `מקום ${q.position}` : "לא מוזכר"}
                        </span>
                        {q.answerCount > 0 ? (
                          <Button asChild size="sm" variant="secondary">
                            <Link to="/answers/$questionId" params={{ questionId: q.id }}>
                              צפה בתוצאה
                            </Link>
                          </Button>
                        ) : (
                          <span className="shrink-0 text-xs text-muted-foreground">ממתין לסריקה</span>
                        )}
                      </li>
                    ))}
                    {topic.questions.length === 0 ? (
                      <li className="py-2 text-sm text-muted-foreground">אין עדיין שאלות בנושא הזה.</li>
                    ) : null}
                  </ul>

                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-4"
                    onClick={() => setQuestionFor(topic.id)}
                  >
                    <Plus className="h-4 w-4" />
                    הוסף שאלה
                  </Button>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <Dialog open={questionFor !== null} onOpenChange={(v) => !v && setQuestionFor(null)}>
        <DialogContent dir="rtl">
          <DialogHeader className="text-right">
            <DialogTitle>שאלה חדשה</DialogTitle>
            <DialogDescription>נסח את השאלה כפי שגולש היה שואל מנוע AI</DialogDescription>
          </DialogHeader>
          <Input
            placeholder="לדוגמה: מה ביטוח הנסיעות הטוב ביותר ליפן?"
            value={newQuestion}
            onChange={(e) => setNewQuestion(e.target.value)}
          />
          <DialogFooter>
            <Button onClick={handleAddQuestion} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              הוסף שאלה
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

function Stat({ label, value, tone = "text-foreground" }: { label: string; value: string; tone?: string }) {
  return (
    <div className="text-center">
      <p className={`text-lg font-bold ${tone}`}>{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
