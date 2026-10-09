import { NextResponse } from "next/server";
import { runAll } from "@/lib/run";
import { loadSettings, saveRun } from "@/lib/store";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST() {
  const s = await loadSettings();
  if (!s.brand || !s.domain || !s.prompts.length)
    return NextResponse.json({ error: "חסרים שם מותג, דומיין או פרומפטים בהגדרות" }, { status: 400 });
  const run = await runAll(s);
  if (!run.engines.length)
    return NextResponse.json({ error: "לא הוגדר אף מפתח API (או מצב הדגמה)" }, { status: 400 });
  await saveRun(run);
  return NextResponse.json(run);
}
