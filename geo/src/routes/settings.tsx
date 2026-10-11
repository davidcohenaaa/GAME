import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Loader2, Play, Settings2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  getSettingsData,
  updateSettings,
  runManualCollection,
  setupDailyCron,
  getCollectionStatus,
} from "@/lib/geo.functions";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "הגדרות | GEO" },
      { name: "description", content: "הגדרות המותג, האתר ומקורות ה-AI שנכללים במעקב." },
      { property: "og:title", content: "הגדרות | GEO" },
      { property: "og:description", content: "הגדרות המותג, האתר ומקורות ה-AI שנכללים במעקב." },
    ],
  }),
  loader: async () => {
    const [settingsData, status] = await Promise.all([getSettingsData(), getCollectionStatus()]);
    return { settings: settingsData.settings, sources: settingsData.sources, status };
  },
  component: SettingsPage,
});

function SettingsPage() {
  const { settings, sources, status } = Route.useLoaderData();
  const [brand, setBrand] = useState(settings["brand_name"] ?? "");
  const [site, setSite] = useState(settings["site_url"] ?? "");
  const [enabled, setEnabled] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(
      Object.entries(settings)
        .filter(([k]) => k.startsWith("source_"))
        .map(([k, v]) => [k.replace("source_", ""), v === "true"]),
    ),
  );
  const [scanning, setScanning] = useState(false);
  const [cronLoading, setCronLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [cronMessage, setCronMessage] = useState<string | null>(null);

  const runScanFn = useServerFn(runManualCollection);
  const setupCronFn = useServerFn(setupDailyCron);
  const updateSettingsFn = useServerFn(updateSettings);

  async function handleSave() {
    setMessage("שומר...");
    try {
      await updateSettingsFn({ data: { brandName: brand, siteUrl: site, sources: enabled } });
      setMessage("ההגדרות נשמרו.");
    } catch (e) {
      setMessage("שגיאה בשמירת הגדרות.");
    }
  }

  async function handleScan() {
    setScanning(true);
    setMessage(null);
    try {
      await runScanFn();
      setMessage("הסריקה הסתיימה.");
    } catch (e) {
      setMessage("הסריקה נכשלה.");
    } finally {
      setScanning(false);
    }
  }

  async function handleCron() {
    setCronLoading(true);
    setCronMessage(null);
    try {
      await setupCronFn();
      setCronMessage("התזמון היומי הופעל.");
    } catch (e) {
      setCronMessage("הפעלת התזמון נכשלה.");
    } finally {
      setCronLoading(false);
    }
  }

  return (
    <AppShell title="הגדרות" subtitle="פרטי המותג ומקורות המעקב">
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="surface-card space-y-5 p-6">
          <h2 className="text-base font-bold">המותג שלי</h2>
          <div>
            <label className="mb-1.5 block text-sm font-medium">שם המותג</label>
            <Input value={brand} onChange={(e) => setBrand(e.target.value)} />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">כתובת האתר</label>
            <Input dir="ltr" value={site} onChange={(e) => setSite(e.target.value)} />
          </div>
          <Button onClick={handleSave}>שמור שינויים</Button>
        </div>

        <div className="surface-card space-y-5 p-6">
          <h2 className="text-base font-bold">סריקת נתונים</h2>
          <p className="text-sm text-muted-foreground">
            סטטוס אחרון: <span className="font-medium text-foreground">{status?.status ?? "אין סריקות"}</span>
            {status?.finished_at ? ` · ${new Date(status.finished_at).toLocaleString("he-IL")}` : null}
          </p>
          {message ? <p className="text-sm text-primary">{message}</p> : null}
          <div className="flex flex-wrap gap-3">
            <Button onClick={handleScan} disabled={scanning}>
              {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              סריקה ידנית
            </Button>
            <Button variant="outline" onClick={handleCron} disabled={cronLoading}>
              {cronLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Settings2 className="h-4 w-4" />}
              הפעל סריקה אוטומטית יומית
            </Button>
          </div>
          {cronMessage ? <p className="text-sm text-primary">{cronMessage}</p> : null}
        </div>

        <div className="surface-card space-y-4 p-6 lg:col-span-2">
          <div>
            <h2 className="text-base font-bold">מקורות AI במעקב</h2>
            <p className="text-xs text-muted-foreground">
              התוצאה הראשית מחושבת כממוצע משוקלל של כל המקורות הפעילים
            </p>
          </div>
          {sources.map((s) => (
            <div
              key={s.id}
              className="flex items-center justify-between rounded-xl border border-border p-3.5"
            >
              <div>
                <span className="text-sm font-medium">{s.label}</span>
                {!s.available ? (
                  <p className="text-xs text-muted-foreground">
                    ממתין למפתח API חיצוני ({s.requiresKey}) — לא ייסרק כרגע
                  </p>
                ) : null}
              </div>
              <Switch
                checked={enabled[s.id] ?? false}
                disabled={!s.available}
                onCheckedChange={(v) => setEnabled((p) => ({ ...p, [s.id]: v }))}
              />
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
