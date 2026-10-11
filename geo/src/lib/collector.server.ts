import { generateText, Output, NoObjectGeneratedError } from "ai";
import { z } from "zod";
import {
  createLovableAiGatewayProvider,
  createLovableResponsesProvider,
} from "./ai-gateway.server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";
import {
  getBrands,
  getQuestions,
  upsertSourceAnswer,
  upsertAnswerRankings,
  updateCollectionRun,
  computeSnapshot,
} from "./geo.server";

const RankingSchema = z.object({
  summary: z.string(),
  brands: z.array(
    z.object({
      name: z.string(),
      position: z.number().nullable(),
      mentioned: z.boolean(),
      has_link: z.boolean(),
    }),
  ),
});

export type SourceKind = "gateway-openai" | "gateway-chat" | "anthropic" | "serp";

export type SourceConfig = {
  id: string;
  model: string;
  label: string;
  kind: SourceKind;
  /** Env var holding the external API key, when the source is not served by Lovable AI. */
  envKey?: string;
};

export const SUPPORTED_SOURCES: SourceConfig[] = [
  { id: "gemini", model: "google/gemini-3.7-flash", label: "Gemini", kind: "gateway-chat" },
  { id: "chatgpt", model: "openai/gpt-5.6-sol", label: "ChatGPT", kind: "gateway-openai" },
  {
    id: "claude",
    model: "anthropic/claude-sonnet-5",
    label: "Claude",
    kind: "anthropic",
  },
  {
    id: "google",
    model: "serpapi/google-ai-overview",
    label: "Google AI Overview",
    kind: "serp",
    envKey: "SERPAPI_API_KEY",
  },
];

export function isSourceReady(source: SourceConfig) {
  if (!source.envKey) return true;
  return Boolean(process.env[source.envKey]);
}

const OUTPUT_SPEC = `Return a JSON object with:
- "summary": a concise Hebrew summary of the answer, focusing on which brands are recommended and why. Under 150 words.
- "brands": an array with one object per tracked brand:
  - "name": the brand name exactly as listed
  - "position": the brand's rank in the answer (1 = first). null if not mentioned.
  - "mentioned": true/false
  - "has_link": true if the answer links to the brand's website

Rules: use the exact brand names, valid JSON only, summary in Hebrew.`;

function buildPrompt(question: string, brandNames: string[]) {
  return `You are analyzing how different insurance brands appear in AI-generated answers to the following Hebrew question.

Question: "${question}"

Tracked brands: ${brandNames.join(", ")}

${OUTPUT_SPEC}`;
}

function buildAnalysisPrompt(question: string, brandNames: string[], answerText: string) {
  return `Below is the real answer text produced for a Hebrew question. Analyze it — do not invent content.

Question: "${question}"

Tracked brands: ${brandNames.join(", ")}

Answer text:
"""
${answerText.slice(0, 12000)}
"""

${OUTPUT_SPEC}`;
}

/** Structure arbitrary answer text into the ranking schema using Gemini through Lovable AI. */
async function structureText(
  apiKey: string,
  question: string,
  brandNames: string[],
  answerText: string,
) {
  const gateway = createLovableAiGatewayProvider(apiKey);
  const { output } = await generateText({
    model: gateway("google/gemini-3.7-flash"),
    output: Output.object({ schema: RankingSchema }),
    prompt: buildAnalysisPrompt(question, brandNames, answerText),
  });
  return output;
}

/** Claude via Lovable AI Gateway native Messages API (streamed). */
async function callAnthropic(source: SourceConfig, apiKey: string, question: string) {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "Lovable-API-Key": apiKey,
      "anthropic-version": "2023-06-01",
      "X-Lovable-AIG-SDK": "fetch",
    },
    body: JSON.stringify({
      model: source.model,
      max_tokens: 2048,
      stream: true,
      messages: [{ role: "user", content: `${question}\n\nענה בעברית בצורה מלאה ומפורטת.` }],
    }),
  });

  if (!res.ok || !res.body) {
    throw new Error(`Claude ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      try {
        const evt = JSON.parse(line.slice(5).trim()) as {
          type?: string;
          delta?: { type?: string; text?: string };
        };
        if (evt.type === "content_block_delta" && evt.delta?.type === "text_delta") {
          text += evt.delta.text ?? "";
        }
      } catch {
        // ignore keep-alive / partial lines
      }
    }
  }
  return text.trim();
}

/** Google AI Overview via SerpAPI (requires SERPAPI_API_KEY). */
async function callGoogleAiOverview(question: string) {
  const key = process.env["SERPAPI_API_KEY"];
  if (!key) throw new Error("Missing SERPAPI_API_KEY");

  const url = new URL("https://serpapi.com/search.json");
  url.searchParams.set("engine", "google");
  url.searchParams.set("q", question);
  url.searchParams.set("hl", "he");
  url.searchParams.set("gl", "il");
  url.searchParams.set("api_key", key);

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`SerpAPI ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }

  const json = (await res.json()) as {
    ai_overview?: {
      text_blocks?: { snippet?: string; list?: { snippet?: string }[] }[];
      references?: { title?: string; link?: string; source?: string }[];
    };
  };

  const overview = json.ai_overview;
  if (!overview) return "";

  const blocks = (overview.text_blocks ?? [])
    .flatMap((b) => [b.snippet ?? "", ...(b.list ?? []).map((l) => l.snippet ?? "")])
    .filter(Boolean)
    .join("\n");

  const refs = (overview.references ?? [])
    .map((r) => `${r.source ?? r.title ?? ""} — ${r.link ?? ""}`)
    .filter((r) => r.trim() !== "—")
    .join("\n");

  return [blocks, refs ? `\nמקורות מקושרים:\n${refs}` : ""].join("").trim();
}

async function callSource(
  source: SourceConfig,
  apiKey: string,
  question: string,
  brandNames: string[],
) {
  try {
    if (source.kind === "gateway-openai") {
      const gateway = createLovableResponsesProvider(apiKey);
      const { output } = await generateText({
        model: gateway.responses(source.model),
        output: Output.object({ schema: RankingSchema }),
        prompt: buildPrompt(question, brandNames),
      });
      return output;
    }

    if (source.kind === "gateway-chat") {
      const gateway = createLovableAiGatewayProvider(apiKey);
      const { output } = await generateText({
        model: gateway(source.model),
        output: Output.object({ schema: RankingSchema }),
        prompt: buildPrompt(question, brandNames),
      });
      return output;
    }

    const answerText =
      source.kind === "anthropic"
        ? await callAnthropic(source, apiKey, question)
        : await callGoogleAiOverview(question);

    if (!answerText) return null;
    return await structureText(apiKey, question, brandNames, answerText);
  } catch (error) {
    if (NoObjectGeneratedError.isInstance(error)) {
      return null;
    }
    throw error;
  }
}

export async function collectQuestion(
  supabase: SupabaseClient<Database>,
  apiKey: string,
  questionId: string,
  questionText: string,
  brands: { id: string; name: string }[],
  sourceIds: string[],
  runId: string,
) {
  const brandNames = brands.map((b) => b.name);
  const brandMap = new Map(brands.map((b) => [b.name, b.id]));
  const logs: string[] = [];

  for (const sourceId of sourceIds) {
    const source = SUPPORTED_SOURCES.find((s) => s.id === sourceId);
    if (!source) {
      logs.push(`skipped unsupported source ${sourceId} for question ${questionId}`);
      continue;
    }
    if (!isSourceReady(source)) {
      logs.push(`skipped ${sourceId}: missing ${source.envKey}`);
      continue;
    }


    try {
      const result = await callSource(source, apiKey, questionText, brandNames);
      if (!result) {
        logs.push(`no structured output from ${sourceId} for question ${questionId}`);
        continue;
      }

      const sourceAnswerId = await upsertSourceAnswer(supabase, {
        question_id: questionId,
        source: sourceId,
        summary: result.summary,
        raw_response: JSON.stringify(result),
      });

      const rankings = result.brands
        .filter((b) => brandMap.has(b.name))
        .map((b) => ({
          brand_id: brandMap.get(b.name)!,
          position: b.position,
          mentioned: b.mentioned,
          has_link: b.has_link,
        }));

      await upsertAnswerRankings(supabase, sourceAnswerId, rankings);
      logs.push(`collected ${sourceId} for question ${questionId}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logs.push(`error from ${sourceId} for question ${questionId}: ${message}`);
    }
  }

  return logs;
}

export async function runCollection(
  supabase: SupabaseClient<Database>,
  apiKey: string,
  sourceIds: string[],
  runId: string,
) {
  const [brands, questions] = await Promise.all([getBrands(supabase), getQuestions(supabase)]);
  const brandList = brands.map((b) => ({ id: b.id, name: b.name }));

  await updateCollectionRun(supabase, runId, {
    total_questions: questions.length,
    logs: [`starting collection for ${questions.length} questions, sources: ${sourceIds.join(", ")}`] as Json,
  });

  let processed = 0;
  const allLogs: string[] = [];

  for (const question of questions) {
    const logs = await collectQuestion(
      supabase,
      apiKey,
      question.id,
      question.text,
      brandList,
      sourceIds,
      runId,
    );
    allLogs.push(...logs);
    processed++;
    await updateCollectionRun(supabase, runId, {
      questions_processed: processed,
      logs: allLogs as Json,
    });
  }

  await updateCollectionRun(supabase, runId, {
    status: "completed",
    finished_at: new Date().toISOString(),
    logs: allLogs as Json,
  });

  await refreshSnapshots(supabase, brands);
}

export async function refreshSnapshots(
  supabase: SupabaseClient<Database>,
  brands: { id: string; name: string; is_mine: boolean }[],
) {
  const { data: answers, error } = await supabase
    .from("source_answers")
    .select(
      "id, question_id, questions(topic_id, topics(domain_id)), answer_rankings(brand_id, position, mentioned, has_link, brands(is_mine))",
    );
  if (error || !answers) {
    console.warn("refreshSnapshots failed", error);
    return;
  }

  const today = new Date().toISOString().slice(0, 10);
  const byDomain = new Map<string, { mentions: number[]; positions: number[]; links: number[]; minePositions: number[]; mineMentions: number[]; mineLinks: number[] }>();

  for (const answer of answers as unknown as {
    id: string;
    questions: { topic_id: string; topics: { domain_id: string } | null } | null;
    answer_rankings: {
      brand_id: string;
      position: number | null;
      mentioned: boolean;
      has_link: boolean;
      brands: { is_mine: boolean } | null;
    }[];
  }[]) {
    const domainId = answer.questions?.topics?.domain_id ?? "all";
    if (!byDomain.has(domainId)) {
      byDomain.set(domainId, { mentions: [], positions: [], links: [], minePositions: [], mineMentions: [], mineLinks: [] });
    }
    const bucket = byDomain.get(domainId)!;
    const allRankings = answer.answer_rankings;
    const mentioned = allRankings.filter((r) => r.mentioned);
    bucket.mentions.push(mentioned.length);
    bucket.positions.push(...mentioned.map((r) => r.position).filter((p): p is number => p !== null));
    bucket.links.push(...mentioned.filter((r) => r.has_link).map(() => 1));

    const mine = allRankings.filter((r) => r.brands?.is_mine);
    bucket.mineMentions.push(mine.filter((r) => r.mentioned).length > 0 ? 1 : 0);
    bucket.minePositions.push(...mine.map((r) => r.position).filter((p): p is number => p !== null));
    bucket.mineLinks.push(...mine.filter((r) => r.has_link).map(() => 1));
  }

  for (const [domainId, bucket] of byDomain) {
    const avgPos = bucket.positions.length ? bucket.positions.reduce((a, b) => a + b, 0) / bucket.positions.length : 0;
    const mineAvgPos = bucket.minePositions.length
      ? bucket.minePositions.reduce((a, b) => a + b, 0) / bucket.minePositions.length
      : 0;
    const mentionRate = answers.length ? (bucket.mineMentions.filter((v) => v === 1).length / answers.length) * 100 : 0;
    const linkRate = bucket.mineMentions.length
      ? (bucket.mineLinks.length / bucket.mineMentions.length) * 100
      : 0;

    await computeSnapshot(supabase, today, domainId, "avg_position", Number(avgPos.toFixed(2)));
    await computeSnapshot(supabase, today, domainId, "mine_avg_position", Number(mineAvgPos.toFixed(2)));
    await computeSnapshot(supabase, today, domainId, "mine_mention_rate", Number(mentionRate.toFixed(2)));
    await computeSnapshot(supabase, today, domainId, "mine_link_rate", Number(linkRate.toFixed(2)));
  }
}
