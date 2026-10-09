import { NextResponse } from "next/server";
import { analyzeCompetitors } from "@/lib/competitor";
import { loadAnalysis, loadRun, loadSettings, saveAnalysis } from "@/lib/store";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET() {
  return NextResponse.json({ analysis: await loadAnalysis() });
}

export async function POST() {
  const [run, s] = await Promise.all([loadRun(), loadSettings()]);
  if (!run) return NextResponse.json({ error: "קודם הרץ בדיקה בדשבורד" }, { status: 400 });
  if (!run.competitors.length) return NextResponse.json({ error: "לא הוגדרו מתחרים" }, { status: 400 });
  const analysis = await analyzeCompetitors(s, run);
  await saveAnalysis(analysis);
  return NextResponse.json({ analysis });
}
