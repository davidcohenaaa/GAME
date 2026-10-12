import { Link } from "@tanstack/react-router";
import {
  LayoutDashboard,
  ListChecks,
  MessageSquareText,
  BarChart3,
  Sparkles,
  Users,
  Settings,
} from "lucide-react";
import type { ReactNode } from "react";

const NAV = [
  { to: "/", label: "לוח בקרה", icon: LayoutDashboard, exact: true },
  { to: "/topics", label: "נושאים ושאלות", icon: ListChecks },
  { to: "/answers", label: "תשובות", icon: MessageSquareText },
  { to: "/comparison", label: "השוואות לפי תחום", icon: BarChart3 },
  { to: "/content", label: "צור תוכן מהאתר שלי", icon: Sparkles },
  { to: "/competitors", label: "מתחרים", icon: Users },
  { to: "/settings", label: "הגדרות", icon: Settings },
] as const;

export function AppShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <div dir="rtl" className="min-h-screen bg-background">
      <div className="flex min-h-screen">
        <aside className="sticky top-0 flex h-screen w-16 shrink-0 flex-col border-l border-sidebar-border bg-sidebar px-2 py-6 md:w-64 md:px-4">
          <div className="mb-8 flex items-center gap-3 md:px-2">
            <div className="mx-auto grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary text-lg font-black text-primary-foreground md:mx-0">
              G
            </div>
            <div className="hidden min-w-0 md:block">
              <p className="truncate text-lg font-black tracking-tight text-sidebar-foreground">GEO</p>
              <p className="truncate text-xs text-muted-foreground">נראות מותג ב-AI</p>
            </div>
          </div>

          <nav className="flex flex-1 flex-col gap-1">
            {NAV.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  title={item.label}
                  activeOptions={{ exact: "exact" in item ? item.exact : false }}
                  activeProps={{
                    className: "bg-sidebar-accent text-sidebar-accent-foreground font-semibold",
                  }}
                  inactiveProps={{ className: "text-muted-foreground hover:bg-secondary" }}
                  className="flex items-center justify-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors md:justify-start"
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  <span className="hidden truncate md:inline">{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </aside>

        <main className="min-w-0 flex-1">
          <div className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-8 sm:py-10">
            <header className="mb-8">
              <h1 className="text-2xl font-black tracking-tight sm:text-3xl">{title}</h1>
              {subtitle ? (
                <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>
              ) : null}
            </header>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
