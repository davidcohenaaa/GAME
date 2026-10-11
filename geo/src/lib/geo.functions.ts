import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { Json } from "@/integrations/supabase/types";
import {
  getBrands,
  getTopics as getTopicsDb,
  getQuestions,
  getQuestionsWithTopic,
  getSourceAnswersForQuestion,
  getSettings,
  setSettings,
  createCollectionRun,
  updateCollectionRun,
  getLatestCollectionRun,
} from "./geo.server";
import { runCollection, SUPPORTED_SOURCES } from "./collector.server";

const AddTopicSchema = z.object({
  name: z.string().min(1),
  domainId: z.string().min(1),
});

const AddQuestionSchema = z.object({
  topicId: z.string().uuid(),
  text: z.string().min(1),
});

const UpdateSettingsSchema = z.object({
  brandName: z.string().min(1),
  siteUrl: z.string().url(),
  sources: z.record(z.boolean()),
});

export const getDashboardData = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const [brands, topics, questions, settings, latestRun, answers, snapshots] = await Promise.all([
    getBrands(supabaseAdmin),
    getTopicsDb(supabaseAdmin),
    getQuestions(supabaseAdmin),
    getSettings(supabaseAdmin),
    getLatestCollectionRun(supabaseAdmin),
    supabaseAdmin
      .from("source_answers")
      .select(
        "id, question_id, questions(topic_id, topics(domain_id)), answer_rankings(brand_id, position, mentioned, has_link, brands(is_mine))",
      ),
    supabaseAdmin
      .from("snapshots")
      .select("snapshot_date, domain_id, metric_name, metric_value")
      .eq("metric_name", "mine_avg_position")
      .eq("domain_id", "all")
      .gte("snapshot_date", new Date(Date.now() - 180 * 86400000).toISOString().slice(0, 10))
      .order("snapshot_date", { ascending: true }),
  ]);

  const myBrand = brands.find((b) => b.is_mine);

  const allAnswers = (answers.data ?? []) as unknown as {
    id: string;
    questions: { topic_id: string; topics: { domain_id: string } | null } | null;
    answer_rankings: {
      brand_id: string;
      position: number | null;
      mentioned: boolean;
      has_link: boolean;
      brands: { is_mine: boolean } | null;
    }[];
  }[];

  type Bucket = { minePositions: number[]; mineMentions: number; mineLinks: number; answerCount: number };
  const byDomain = new Map<string, Bucket>();
  const bucketFor = (id: string) => {
    if (!byDomain.has(id)) byDomain.set(id, { minePositions: [], mineMentions: 0, mineLinks: 0, answerCount: 0 });
    return byDomain.get(id)!;
  };

  for (const answer of allAnswers) {
    const domainId = answer.questions?.topics?.domain_id;
    const mine = answer.answer_rankings.find((r) => r.brands?.is_mine);
    // Every answer counts toward "all" and toward its own domain
    for (const bucket of domainId ? [bucketFor("all"), bucketFor(domainId)] : [bucketFor("all")]) {
      bucket.answerCount++;
      if (mine?.mentioned) {
        bucket.mineMentions++;
        if (mine.position !== null) bucket.minePositions.push(mine.position);
      }
      if (mine?.has_link) bucket.mineLinks++;
    }
  }

  const avg = (xs: number[]) => (xs.length > 0 ? Number((xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(1)) : 0);
  const rate = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : 0);
  const allBucket = bucketFor("all");

  const metrics = {
    topicCount: topics.length,
    questionCount: questions.length,
    answerCount: allBucket.answerCount,
    avgPosition: avg(allBucket.minePositions),
    mentionRate: rate(allBucket.mineMentions, allBucket.answerCount),
    linkRate: rate(allBucket.mineLinks, allBucket.answerCount),
    domainBreakdown: Array.from(byDomain.entries()).map(([domainId, bucket]) => ({
      domainId,
      rate: rate(bucket.mineMentions, bucket.answerCount),
      avgPosition: avg(bucket.minePositions),
    })),
  };

  const trend = (snapshots.data ?? []).map((s) => ({
    date: s.snapshot_date,
    position: Number(s.metric_value),
  }));

  return {
    brands,
    topics,
    questions,
    settings,
    latestRun,
    myBrand: myBrand ?? null,
    metrics,
    trend,
  };
});

export const getTopics = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const [topics, questions, answers] = await Promise.all([
    getTopicsDb(supabaseAdmin),
    getQuestionsWithTopic(supabaseAdmin),
    supabaseAdmin
      .from("source_answers")
      .select(
        "id, question_id, answer_rankings(brand_id, position, mentioned, has_link, brands(is_mine))",
      ),
  ]);

  const answersByQuestion = new Map<
    string,
    {
      answerCount: number;
      mineMentions: number;
      minePositions: number[];
      mineLinks: number;
    }
  >();

  for (const answer of (answers.data ?? []) as unknown as {
    id: string;
    question_id: string;
    answer_rankings: {
      brand_id: string;
      position: number | null;
      mentioned: boolean;
      has_link: boolean;
      brands: { is_mine: boolean } | null;
    }[];
  }[]) {
    const bucket = answersByQuestion.get(answer.question_id) ?? {
      answerCount: 0,
      mineMentions: 0,
      minePositions: [],
      mineLinks: 0,
    };
    bucket.answerCount++;
    const mine = answer.answer_rankings.find((r) => r.brands?.is_mine);
    if (mine?.mentioned) {
      bucket.mineMentions++;
      if (mine.position !== null) bucket.minePositions.push(mine.position);
      if (mine.has_link) bucket.mineLinks++;
    }
    answersByQuestion.set(answer.question_id, bucket);
  }

  const questionsWithMetrics = questions.map((q) => {
    const bucket = answersByQuestion.get(q.id);
    return {
      ...q,
      mentioned: (bucket?.mineMentions ?? 0) > 0,
      position:
        bucket && bucket.minePositions.length > 0
          ? Number((bucket.minePositions.reduce((a, b) => a + b, 0) / bucket.minePositions.length).toFixed(1))
          : null,
      hasLink: (bucket?.mineLinks ?? 0) > 0,
      answerCount: bucket?.answerCount ?? 0,
    };
  });

  const topicsWithMetrics = topics.map((t) => {
    const topicQuestions = questionsWithMetrics.filter((q) => q.topic_id === t.id);
    const answered = topicQuestions.filter((q) => q.answerCount > 0);
    const appearanceRate = answered.length > 0
      ? Math.round((answered.filter((q) => q.mentioned).length / answered.length) * 100)
      : 0;
    const positions = topicQuestions.flatMap((q) => (q.position !== null ? [q.position] : []));
    const avgPosition = positions.length > 0
      ? Number((positions.reduce((a, b) => a + b, 0) / positions.length).toFixed(1))
      : 0;
    return {
      ...t,
      appearanceRate,
      avgPosition,
      questions: topicQuestions,
    };
  });

  return { topics: topicsWithMetrics, questions: questionsWithMetrics };
});

export const addTopic = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => AddTopicSchema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: topic, error } = await supabaseAdmin
      .from("topics")
      .insert({ name: data.name, domain_id: data.domainId })
      .select("id, name, domain_id")
      .single();
    if (error) throw error;
    return topic;
  });

export const addQuestion = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => AddQuestionSchema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: question, error } = await supabaseAdmin
      .from("questions")
      .insert({ topic_id: data.topicId, text: data.text })
      .select("id, topic_id, text")
      .single();
    if (error) throw error;
    return question;
  });

export const getAnswers = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: answers, error } = await supabaseAdmin
    .from("source_answers")
    .select(
      "id, question_id, source, summary, collected_at, questions(id, text, topic_id, topics(id, name, domain_id))",
    )
    .order("collected_at", { ascending: false });
  if (error) throw error;
  return answers ?? [];
});

export const getAnswerDetail = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ questionId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [question, sourceAnswers, allBrands] = await Promise.all([
      supabaseAdmin.from("questions").select("id, text, topic_id, topics(id, name, domain_id)").eq("id", data.questionId).single().then((r) => {
        if (r.error) throw r.error;
        return r.data;
      }),
      getSourceAnswersForQuestion(supabaseAdmin, data.questionId),
      getBrands(supabaseAdmin),
    ]);
    return { question, sourceAnswers, allBrands };
  });

export const getComparisonData = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const [brands, topics, answers] = await Promise.all([
    getBrands(supabaseAdmin),
    getTopicsDb(supabaseAdmin),
    supabaseAdmin
      .from("source_answers")
      .select(
        "id, question_id, source, questions(text, topic_id, topics(domain_id)), answer_rankings(brand_id, position, mentioned, has_link)",
      ),
  ]);
  if (answers.error) throw answers.error;
  return { brands, topics, answers: answers.data ?? [] };
});

export const getSettingsData = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { isSourceReady } = await import("./collector.server");
  const settings = await getSettings(supabaseAdmin);
  const sources = SUPPORTED_SOURCES.map((s) => ({
    id: s.id,
    label: s.label,
    available: isSourceReady(s),
    requiresKey: s.envKey,
  }));
  return { settings, sources };
});

export const updateSettings = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => UpdateSettingsSchema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const updates: Record<string, string> = {
      brand_name: data.brandName,
      site_url: data.siteUrl,
    };
    for (const [key, value] of Object.entries(data.sources)) {
      updates[`source_${key}`] = String(value);
    }
    await setSettings(supabaseAdmin, updates);
    return updates;
  });

export const runManualCollection = createServerFn({ method: "POST" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { isSourceReady } = await import("./collector.server");
  const settings = await getSettings(supabaseAdmin);
  const activeSourceIds = SUPPORTED_SOURCES.filter(
    (s) => settings[`source_${s.id}`] === "true" && isSourceReady(s),
  ).map((s) => s.id);

  if (activeSourceIds.length === 0) {
    throw new Error("לא נבחרו מקורות פעילים להפעלת סריקה");
  }

  const questions = await getQuestions(supabaseAdmin);
  const runId = await createCollectionRun(supabaseAdmin, questions.length);

  // Run collection in the background so the request returns immediately
  runCollection(supabaseAdmin, activeSourceIds, runId).catch((err) => {
    console.error("Collection failed", err);
    updateCollectionRun(supabaseAdmin, runId, {
      status: "failed",
      finished_at: new Date().toISOString(),
      logs: [`collection failed: ${err instanceof Error ? err.message : String(err)}`] as Json,
    }).catch(() => {});
  });

  return { runId };
});

export const getCollectionStatus = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const run = await getLatestCollectionRun(supabaseAdmin);
  return run;
});

export const setupDailyCron = createServerFn({ method: "POST" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const secret = process.env["COLLECT_CRON_SECRET"];
  if (!secret) throw new Error("Missing COLLECT_CRON_SECRET");

  const appUrl = process.env["APP_URL"];
  if (!appUrl) throw new Error("Missing APP_URL");
  const url = new URL("/api/public/collect", appUrl).toString();

  const { error } = await supabaseAdmin.rpc("schedule_geo_collection", {
    p_url: url,
    p_secret: secret,
  });
  if (error) throw error;
  return { ok: true };
});
