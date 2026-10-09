import { NextResponse } from "next/server";
import { scoreboard } from "@/lib/analyze";
import { loadRun } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  const run = await loadRun();
  return NextResponse.json(run ? { run, scoreboard: scoreboard(run) } : { run: null });
}
