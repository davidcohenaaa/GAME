import { NextResponse } from "next/server";
import { hostMatches } from "@/lib/analyze";
import { checkLink } from "@/lib/linkcheck";
import { loadRun } from "@/lib/store";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  const { url } = (await req.json()) as { url?: string };
  if (!url?.trim()) return NextResponse.json({ error: "הכנס לינק" }, { status: 400 });
  try {
    const result = await checkLink(url.trim());
    // was this exact page cited in the latest run?
    const run = await loadRun();
    const citedBy = new Set<string>();
    const norm = (u: string) => u.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");
    for (const c of run?.cells ?? [])
      if (c.citations.some((u) => norm(u) === norm(result.finalUrl) || norm(u) === norm(result.url)))
        citedBy.add(c.engine);
    const domainCited = run ? run.cells.some((c) => c.citations.some((u) => hostMatches(u, new URL(result.finalUrl).hostname))) : false;
    return NextResponse.json({ ...result, citedBy: [...citedBy], domainCited, hasRun: Boolean(run) });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "שגיאה" }, { status: 400 });
  }
}
