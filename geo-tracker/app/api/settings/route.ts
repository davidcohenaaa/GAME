import { NextResponse } from "next/server";
import { availableEngines } from "@/lib/run";
import { loadSettings, saveSettings } from "@/lib/store";
import type { Settings } from "@/lib/types";

export const dynamic = "force-dynamic";

const KEYS = ["openai", "perplexity", "gemini", "anthropic", "apify"] as const;

async function view() {
  const s = await loadSettings();
  // keys never leave the server – only whether they are set
  const keysSet = Object.fromEntries(KEYS.map((k) => [k, Boolean(s.keys[k])]));
  return { ...s, keys: undefined, keysSet, engines: availableEngines(s) };
}

export async function GET() {
  return NextResponse.json(await view());
}

export async function POST(req: Request) {
  const body = (await req.json()) as Partial<Settings> & { keys?: Record<string, string> };
  const cur = await loadSettings();
  const keys = { ...cur.keys };
  for (const k of KEYS) {
    const v = body.keys?.[k];
    if (typeof v === "string" && v.trim()) keys[k] = v.trim();
  }
  const next: Settings = {
    brand: String(body.brand ?? cur.brand).trim(),
    domain: String(body.domain ?? cur.domain).trim(),
    competitors: (body.competitors ?? cur.competitors)
      .filter((c) => c.name?.trim() && c.domain?.trim())
      .slice(0, 5),
    prompts: (body.prompts ?? cur.prompts).map((p) => p.trim()).filter(Boolean).slice(0, 30),
    demo: Boolean(body.demo ?? cur.demo),
    keys,
  };
  await saveSettings(next);
  return NextResponse.json(await view());
}
