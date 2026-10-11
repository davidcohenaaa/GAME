import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { FileText, HelpCircle, Info, PenLine, Sparkles } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TOPICS } from "@/data/mock";

export const Route = createFileRoute("/content")({
  head: () => ({
    meta: [
      { title: "צור תוכן מהאתר שלי | GEO" },
      {
        name: "description",
        content: "יצירת שאלות ותשובות, מאמר או שיפור עמוד קיים – רק על בסיס המידע שקיים באתר שלך.",
      },
      { property: "og:title", content: "צור תוכן מהאתר שלי | GEO" },
      { property: "og:description", content: "תוכן חדש שנבנה רק מהמידע שקיים באתר שלך." },
    ],
  }),
  component: ContentPage,
});

const TYPES = [
  { id: "faq", label: "שאלות ותשובות (FAQ)", icon: HelpCircle },
  { id: "article", label: "מאמר חדש", icon: FileText },
  { id: "improve", label: "שיפור עמוד קיים", icon: PenLine },
] as const;

function ContentPage() {
  const [url, setUrl] = useState("");
  const [type, setType] = useState<string>("faq");
  const [topic, setTopic] = useState(TOPICS[0]?.id ?? "");
  const [result, setResult] = useState<string | null>(null);

  return (
    <AppShell title="צור תוכן מהאתר שלי" subtitle="תוכן שמבוסס אך ורק על מה שכבר קיים באתר שלך">
      <div className="mb-6 rounded-xl border border-dashed border-border bg-secondary p-4 text-sm text-muted-foreground">
        המסך הזה עדיין לא מחובר: התוכן שמוצג כאן הוא דוגמה קבועה ולא נוצר מהאתר שלך.
      </div>
      <div className="grid gap-6 lg:grid-cols-5">
        <div className="surface-card space-y-6 p-6 lg:col-span-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium">כתובת עמוד מהאתר שלי</label>
            <Input
              dir="ltr"
              placeholder="https://mysite.co.il/travel-insurance"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </div>

          <div>
            <p className="mb-2 text-sm font-medium">סוג התוכן</p>
            <div className="space-y-2">
              {TYPES.map((t) => {
                const Icon = t.icon;
                const active = type === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setType(t.id)}
                    className={`flex w-full items-center gap-3 rounded-xl border p-3.5 text-right text-sm transition-colors ${
                      active
                        ? "border-primary bg-primary/5 font-semibold text-primary"
                        : "border-border bg-card text-muted-foreground hover:bg-secondary"
                    }`}
                  >
                    <Icon className="h-4.5 w-4.5 shrink-0" />
                    <span className="truncate">{t.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">נושא</label>
            <Select value={topic} onValueChange={setTopic}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TOPICS.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-3 rounded-xl bg-secondary p-4 text-xs leading-6 text-muted-foreground">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <p>
              המערכת משתמשת אך ורק במידע שקיים באתר שלך. היא לא ממציאה עובדות, מחירים או כיסויים
              שאינם מופיעים בעמוד שהזנת.
            </p>
          </div>

          <Button
            className="w-full"
            size="lg"
            onClick={() => setResult(type)}
            disabled={!url.trim()}
          >
            <Sparkles className="h-4.5 w-4.5" />
            צור תוכן
          </Button>
        </div>

        <div className="lg:col-span-3">
          {result ? (
            <div className="surface-card p-6">
              <div className="mb-5 flex items-center justify-between">
                <h2 className="text-base font-bold">התוכן שנוצר</h2>
                <span className="rounded-lg bg-success/10 px-2.5 py-1 text-xs font-medium text-success">
                  מבוסס על העמוד שלך
                </span>
              </div>
              {result === "faq" ? <FaqMock /> : result === "article" ? <ArticleMock /> : <ImproveMock />}
              <div className="mt-6 flex gap-3">
                <Button variant="outline">העתק</Button>
                <Button variant="secondary">שמור טיוטה</Button>
              </div>
            </div>
          ) : (
            <div className="surface-card grid h-full min-h-64 place-items-center p-10 text-center">
              <div>
                <Sparkles className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  הזן כתובת עמוד ולחץ ״צור תוכן״ כדי לראות תצוגה מקדימה.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}

const FAQ = [
  {
    q: "מה מכסה ביטוח נסיעות לחו״ל?",
    a: "לפי העמוד שלך, הכיסוי הבסיסי כולל הוצאות רפואיות בחו״ל, אשפוז, פינוי רפואי וביטול נסיעה. הרחבות ניתן להוסיף לכבודה, ספורט אתגרי ומצב רפואי קיים.",
  },
  {
    q: "האם יש השתתפות עצמית?",
    a: "בעמוד שלך מצוין שהתשלום מתבצע ישירות מול נותן השירות בחו״ל, ללא צורך בתשלום מראש והחזר בדיעבד.",
  },
  {
    q: "כמה זמן לפני הנסיעה כדאי לרכוש?",
    a: "העמוד ממליץ לרכוש מיד לאחר הזמנת הטיסה, כדי שכיסוי ביטול הנסיעה יהיה בתוקף.",
  },
  {
    q: "האם הביטוח מתאים למשפחות?",
    a: "כן. לפי העמוד קיימת פוליסה משפחתית שמכסה הורים וילדים תחת פוליסה אחת.",
  },
];

function FaqMock() {
  return (
    <div className="space-y-4">
      {FAQ.map((f) => (
        <div key={f.q} className="rounded-xl border border-border p-4">
          <p className="mb-1.5 text-sm font-bold">{f.q}</p>
          <p className="text-sm leading-7 text-muted-foreground">{f.a}</p>
        </div>
      ))}
    </div>
  );
}

function ArticleMock() {
  return (
    <article className="space-y-4">
      <h3 className="text-xl font-black">המדריך המלא לביטוח נסיעות לחו״ל – מה חשוב לבדוק לפני הטיסה</h3>
      <p className="text-sm leading-7 text-muted-foreground">
        ביטוח נסיעות הוא הרשת הביטחונית שלך בחו״ל. במדריך הזה נעבור על מרכיבי הכיסוי המרכזיים
        כפי שהם מופיעים באתר שלנו, ונסביר איך לבחור פוליסה שמתאימה לסוג הנסיעה.
      </p>
      <h4 className="text-base font-bold">1. הוצאות רפואיות ואשפוז</h4>
      <p className="text-sm leading-7 text-muted-foreground">
        זהו הרכיב החשוב ביותר. הפוליסה מכסה טיפול רפואי, אשפוז ופינוי רפואי לישראל במקרה הצורך.
      </p>
      <h4 className="text-base font-bold">2. ביטול וקיצור נסיעה</h4>
      <p className="text-sm leading-7 text-muted-foreground">
        כיסוי להוצאות שלא ניתן להחזיר במקרה של ביטול מסיבות מוגדרות בפוליסה.
      </p>
      <h4 className="text-base font-bold">3. הרחבות אפשריות</h4>
      <p className="text-sm leading-7 text-muted-foreground">
        כבודה, ספורט אתגרי, הריון ומצב רפואי קיים – כל אחת מהן נרכשת בנפרד לפי הצורך.
      </p>
    </article>
  );
}

function ImproveMock() {
  return (
    <div className="space-y-3">
      {[
        "הוסף מקטע FAQ בסוף העמוד עם 8-12 שאלות בניסוח טבעי.",
        "פצל את הפסקה הראשית לכותרות משנה: מי מתאים, מה מכוסה, מה לא מכוסה.",
        "הוסף טבלת השוואת מסלולים עם סכומי כיסוי מדויקים.",
        "עדכן את תאריך העדכון האחרון בראש העמוד.",
        "הוסף קישורים פנימיים לעמוד התביעות ולמדריך הרכישה.",
      ].map((s, i) => (
        <div key={s} className="flex gap-3 rounded-xl border border-border p-3.5 text-sm leading-6">
          <span className="grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-primary text-xs font-bold text-primary-foreground">
            {i + 1}
          </span>
          <span>{s}</span>
        </div>
      ))}
    </div>
  );
}
