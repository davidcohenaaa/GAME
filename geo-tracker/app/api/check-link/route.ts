import { NextResponse } from "next/server";
import { hostMatches } from "@/lib/analyze";
import { checkLink } from "@/lib/linkcheck";
import { readPage } from "@/lib/readpage";
import { mockLinkCheck } from "@/lib/mock";
import { isDemo, loadRun, loadSettings } from "@/lib/store";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(req: Request) {
  const { url } = (await req.json()) as { url?: string };
  if (!url?.trim()) return NextResponse.json({ error: "הכנס לינק" }, { status: 400 });
  try {
    const s = await loadSettings();
    const [result, read] = await Promise.all([(isDemo(s) ? Promise.resolve(mockLinkCheck(url.trim())) : checkLink(url.trim())), readPage(s, url.trim())]);
    // was this exact page cited in the latest run?
    const run = await loadRun();
    const citedBy = new Set<string>();
    const norm = (u: string) => u.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");
    for (const c of run?.cells ?? [])
      if (c.citations.some((u) => norm(u) === norm(result.finalUrl) || norm(u) === norm(result.url)))
        citedBy.add(c.engine);
    const domainCited = run ? run.cells.some((c) => c.citations.some((u) => hostMatches(u, new URL(result.finalUrl).hostname))) : false;
    return NextResponse.json({ ...result, read, citedBy: [...citedBy], domainCited, hasRun: Boolean(run) });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "שגיאה" }, { status: 400 });
  }
}
