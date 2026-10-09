import { NextResponse } from "next/server";
import { checkLink } from "@/lib/linkcheck";
import { recommend } from "@/lib/recommend";
import { loadRun } from "@/lib/store";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  const run = await loadRun();
  if (!run) return NextResponse.json({ recommendations: [] });
  const link = await checkLink(run.domain).catch(() => null); // best effort
  return NextResponse.json({ recommendations: recommend(run, link) });
}
