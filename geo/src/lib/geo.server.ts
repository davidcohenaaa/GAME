import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";

export type Brand = {
  id: string;
  name: string;
  website_url: string | null;
  is_mine: boolean;
  aliases: string[];
};

export type Topic = {
  id: string;
  name: string;
  domain_id: string;
};

export type Question = {
  id: string;
  topic_id: string;
  text: string;
};

export type SourceAnswer = {
  id: string;
  question_id: string;
  source: string;
  summary: string | null;
  raw_response: string | null;
  collected_at: string;
};

export type AnswerRanking = {
  id: string;
  source_answer_id: string;
  brand_id: string;
  position: number | null;
  mentioned: boolean;
  has_link: boolean;
  brands?: Brand | null;
};

export async function getBrands(supabase: SupabaseClient<Database>): Promise<Brand[]> {
  const { data, error } = await supabase.from("brands").select("id, name, website_url, is_mine, aliases").order("name");
  if (error) throw error;
  return data ?? [];
}

export async function getTopics(supabase: SupabaseClient<Database>): Promise<Topic[]> {
  const { data, error } = await supabase.from("topics").select("id, name, domain_id").order("name");
  if (error) throw error;
  return data ?? [];
}

export async function getQuestions(supabase: SupabaseClient<Database>): Promise<Question[]> {
  const { data, error } = await supabase.from("questions").select("id, topic_id, text").order("created_at");
  if (error) throw error;
  return data ?? [];
}

export async function getQuestionsWithTopic(supabase: SupabaseClient<Database>) {
  const { data, error } = await supabase
    .from("questions")
    .select("id, text, topic_id, topics(id, name, domain_id)")
    .order("created_at");
  if (error) throw error;
  return data ?? [];
}

export async function getSourceAnswersForQuestion(
  supabase: SupabaseClient<Database>,
  questionId: string,
): Promise<(SourceAnswer & { answer_rankings: (AnswerRanking & { brands: Brand | null })[] })[]> {
  const { data, error } = await supabase
    .from("source_answers")
    .select(
      "id, question_id, source, summary, raw_response, collected_at, answer_rankings(id, source_answer_id, brand_id, position, mentioned, has_link, brands(id, name, website_url, is_mine, aliases))",
    )
    .eq("question_id", questionId);
  if (error) throw error;
  return (data ?? []).map((row) => ({
    ...row,
    answer_rankings: (row.answer_rankings ?? []).map((r) => ({
      ...r,
      brands: r.brands as Brand | null,
    })),
  }));
}

export async function upsertSourceAnswer(
  supabase: SupabaseClient<Database>,
  payload: {
    question_id: string;
    source: string;
    summary: string;
    raw_response: string;
  },
): Promise<string> {
  const { data, error } = await supabase
    .from("source_answers")
    .upsert(payload, { onConflict: "question_id,source" })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

export async function upsertAnswerRankings(
  supabase: SupabaseClient<Database>,
  sourceAnswerId: string,
  rankings: { brand_id: string; position: number | null; mentioned: boolean; has_link: boolean }[],
) {
  const { error } = await supabase.from("answer_rankings").upsert(
    rankings.map((r) => ({ source_answer_id: sourceAnswerId, ...r })),
    { onConflict: "source_answer_id,brand_id" },
  );
  if (error) throw error;
}

export async function getSettings(supabase: SupabaseClient<Database>): Promise<Record<string, string>> {
  const { data, error } = await supabase.from("settings").select("key, value");
  if (error) throw error;
  return Object.fromEntries((data ?? []).map((s) => [s.key, s.value]));
}

export async function setSettings(
  supabase: SupabaseClient<Database>,
  updates: Record<string, string>,
) {
  const { error } = await supabase.from("settings").upsert(
    Object.entries(updates).map(([key, value]) => ({ key, value })),
    { onConflict: "key" },
  );
  if (error) throw error;
}

export async function createCollectionRun(supabase: SupabaseClient<Database>, totalQuestions: number) {
  const { data, error } = await supabase
    .from("collection_runs")
    .insert({ status: "running", total_questions: totalQuestions, logs: [] })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

export async function updateCollectionRun(
  supabase: SupabaseClient<Database>,
  runId: string,
  updates: Partial<{
    status: string;
    finished_at: string;
    questions_processed: number;
    total_questions: number;
    logs: Json;
  }>,
) {
  const { error } = await supabase.from("collection_runs").update(updates).eq("id", runId);
  if (error) throw error;
}

export async function getLatestCollectionRun(supabase: SupabaseClient<Database>) {
  const { data, error } = await supabase
    .from("collection_runs")
    .select("*")
    .order("started_at", { ascending: false })
    .limit(1)
    .single();
  if (error && error.code !== "PGRST116") throw error;
  return data ?? null;
}

export async function computeSnapshot(
  supabase: SupabaseClient<Database>,
  date: string,
  domainId: string,
  metricName: string,
  value: number,
) {
  const { error } = await supabase.from("snapshots").upsert(
    { snapshot_date: date, domain_id: domainId, metric_name: metricName, metric_value: value },
    { onConflict: "snapshot_date,domain_id,metric_name" },
  );
  if (error) throw error;
}
