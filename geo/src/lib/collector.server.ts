import Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";
import { matchBrands, type MatchBrand } from "./brand-match";
import {
  getBrands,
  getQuestions,
  upsertSourceAnswer,
  upsertAnswerRankings,
  updateCollectionRun,
  computeSnapshot,
} from "./geo.server";

export type SourceConfig = {
  id: string;
  label: string;
  /** Env var holding the provider API key. */
  envKey: string;
  /** Env var that overrides the default model. */
  modelEnv?: string;
  defaultModel?: string;
};

export const SUPPORTED_SOURCES: SourceConfig[] = [
  { id: "chatgpt", label: "ChatGPT", envKey: "OPENAI_API_KEY", modelEnv: "OPENAI_MODEL", defaultModel: "gpt-5" },
  {
    id: "gemini",
    label: "Gemini",
    envKey: "GEMINI_API_KEY",
    modelEnv: "GEMINI_MODEL",
    defaultModel: "gemini-flash-latest",
  },
  {
    id: "claude",
    label: "Claude",
    envKey: "ANTHROPIC_API_KEY",
    modelEnv: "CLAUDE_MODEL",
    defaultModel: "claude-opus-5-5",
  },
  { id: "google", label: "Google AI Overview", envKey: "SERPAPI_API_KEY" },
];

export function isSourceReady(source: SourceConfig) {
  return Boolean(process.env[source.envKey]);
}

function modelFor(source: SourceConfig) {
  return (source.modelEnv && process.env[source.modelEnv]) || source.defaultModel || "";
}

type Citation = { url: string; title?: string | null | undefined };
type SourceResult = { text: string; citations: Citation[]; model: string };

// Asked the way a user in Israel would ask: in Hebrew, no hint about which brands we track.
function userPrompt(question: string) {
  return `${question}\n\nענה בעברית.`;
}

/** ChatGPT: OpenAI Responses API with web search, like ChatGPT with search on. */
async function askChatGpt(source: SourceConfig, question: string): Promise<SourceResult> {
  const model = modelFor(source);
  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${process.env[source.envKey]}`,
    },
    body: JSON.stringify({
      model,
      input: userPrompt(question),
      tools: [{ type: "web_search", user_location: { type: "approximate", country: "IL" } }],
    }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 300)}`);

  const json = (await res.json()) as {
    output?: {
      type: string;
      content?: { type: string; text?: string; annotations?: { type: string; url?: string; title?: string }[] }[];
    }[];
  };

  let text = "";
  const citations: Citation[] = [];
  for (const item of json.output ?? []) {
    if (item.type !== "message") continue;
    for (const part of item.content ?? []) {
      if (part.type !== "output_text") continue;
      text += part.text ?? "";
      for (const a of part.annotations ?? []) {
        if (a.type === "url_citation" && a.url) citations.push({ url: a.url, title: a.title });
      }
    }
  }
  return { text: text.trim(), citations, model };
}

/** Gemini: generateContent grounded with Google Search. */
async function askGemini(source: SourceConfig, question: string): Promise<SourceResult> {
  const model = modelFor(source);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-goog-api-key": process.env[source.envKey] ?? "",
    },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: userPrompt(question) }] }],
      tools: [{ google_search: {} }],
    }),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 300)}`);

  const json = (await res.json()) as {
    candidates?: {
      content?: { parts?: { text?: string }[] };
      groundingMetadata?: { groundingChunks?: { web?: { uri?: string; title?: string } }[] };
    }[];
  };
  const candidate = json.candidates?.[0];
  const text = (candidate?.content?.parts ?? []).map((p) => p.text ?? "").join("").trim();
  const citations = (candidate?.groundingMetadata?.groundingChunks ?? [])
    .flatMap((c) => (c.web?.uri ? [{ url: c.web.uri, title: c.web.title }] : []));
  return { text, citations, model };
}

/** Claude: Messages API with the server-side web search tool. */
async function askClaude(source: SourceConfig, question: string): Promise<SourceResult> {
  const model = modelFor(source);
  const client = new Anthropic({ apiKey: process.env[source.envKey] });
  const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: "user", content: userPrompt(question) }];

  let text = "";
  const citations: Citation[] = [];
  // Server tools can pause a long turn; resend to let Claude continue (bounded).
  for (let i = 0; i < 4; i++) {
    const response = await client.beta.messages.create({
      model,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      tools: [
        {
          type: "web_search_20260209",
          name: "web_search",
          max_uses: 5,
          user_location: { type: "approximate", country: "IL", timezone: "Asia/Jerusalem" },
        },
      ],
      messages,
    });

    if (response.stop_reason === "refusal") {
      throw new Error(`Claude refused (${response.stop_details?.category ?? "unknown"})`);
    }

    for (const block of response.content) {
      if (block.type === "text") {
        text += block.text;
        for (const c of block.citations ?? []) {
          if (c.type === "web_search_result_location") citations.push({ url: c.url, title: c.title });
        }
      }
    }

    if (response.stop_reason !== "pause_turn") break;
    messages.push({ role: "assistant", content: response.content });
  }
  return { text: text.trim(), citations, model };
}

/** Google AI Overview via SerpAPI. Empty text when Google shows no AI Overview for the query. */
async function askGoogleAiOverview(source: SourceConfig, question: string): Promise<SourceResult> {
  const url = new URL("https://serpapi.com/search.json");
  url.searchParams.set("engine", "google");
  url.searchParams.set("q", question);
  url.searchParams.set("hl", "iw");
  url.searchParams.set("gl", "il");
  url.searchParams.set("google_domain", "google.co.il");
  url.searchParams.set("api_key", process.env[source.envKey] ?? "");

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`SerpAPI ${res.status}: ${(await res.text()).slice(0, 300)}`);

  type Overview = {
    text_blocks?: { snippet?: string; list?: { snippet?: string; title?: string }[] }[];
    references?: { title?: string; link?: string; source?: string }[];
    page_token?: string;
  };
  let overview = ((await res.json()) as { ai_overview?: Overview }).ai_overview;

  // Some results return only a token; the overview content needs a second request.
  if (overview?.page_token && !overview.text_blocks) {
    const next = new URL("https://serpapi.com/search.json");
    next.searchParams.set("engine", "google_ai_overview");
    next.searchParams.set("page_token", overview.page_token);
    next.searchParams.set("api_key", process.env[source.envKey] ?? "");
    const res2 = await fetch(next.toString());
    if (res2.ok) overview = ((await res2.json()) as { ai_overview?: Overview }).ai_overview;
  }
  if (!overview) return { text: "", citations: [], model: "google-ai-overview" };

  const text = (overview.text_blocks ?? [])
    .flatMap((b) => [b.snippet ?? "", ...(b.list ?? []).map((l) => [l.title, l.snippet].filter(Boolean).join(" "))])
    .filter(Boolean)
    .join("\n")
    .trim();
  const citations = (overview.references ?? [])
    .flatMap((r) => (r.link ? [{ url: r.link, title: r.source ?? r.title }] : []));
  return { text, citations, model: "google-ai-overview" };
}

function askSource(source: SourceConfig, question: string) {
  switch (source.id) {
    case "chatgpt":
      return askChatGpt(source, question);
    case "gemini":
      return askGemini(source, question);
    case "claude":
      return askClaude(source, question);
    case "google":
      return askGoogleAiOverview(source, question);
    default:
      throw new Error(`unsupported source ${source.id}`);
  }
}

export async function collectQuestion(
  supabase: SupabaseClient<Database>,
  questionId: string,
  questionText: string,
  brands: MatchBrand[],
  sourceIds: string[],
) {
  const sources = sourceIds.flatMap((id) => {
    const s = SUPPORTED_SOURCES.find((x) => x.id === id);
    return s && isSourceReady(s) ? [s] : [];
  });

  // Sources are independent, so ask them in parallel
  const logs = await Promise.all(
    sources.map(async (source) => {
      try {
        const result = await askSource(source, questionText);
        if (!result.text) return `no answer from ${source.id} for question ${questionId}`;

        const sourceAnswerId = await upsertSourceAnswer(supabase, {
          question_id: questionId,
          source: source.id,
          summary: result.text,
          raw_response: JSON.stringify(result),
        });
        await upsertAnswerRankings(supabase, sourceAnswerId, matchBrands(result.text, result.citations, brands));
        return `collected ${source.id} for question ${questionId}`;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return `error from ${source.id} for question ${questionId}: ${message}`;
      }
    }),
  );

  const skipped = sourceIds.filter((id) => !sources.some((s) => s.id === id));
  return [...logs, ...skipped.map((id) => `skipped ${id}: missing API key`)];
}

export async function runCollection(
  supabase: SupabaseClient<Database>,
  sourceIds: string[],
  runId: string,
) {
  const [brands, questions] = await Promise.all([getBrands(supabase), getQuestions(supabase)]);

  await updateCollectionRun(supabase, runId, {
    total_questions: questions.length,
    logs: [`starting collection for ${questions.length} questions, sources: ${sourceIds.join(", ")}`] as Json,
  });

  let processed = 0;
  const allLogs: string[] = [];

  for (const question of questions) {
    const logs = await collectQuestion(supabase, question.id, question.text, brands, sourceIds);
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

  await refreshSnapshots(supabase);
}

type Bucket = { answers: number; mineMentions: number; minePositions: number[]; mineLinks: number };

/** Writes today's metrics for my brand, per domain and for "all". */
export async function refreshSnapshots(supabase: SupabaseClient<Database>) {
  const { data: answers, error } = await supabase
    .from("source_answers")
    .select("id, questions(topics(domain_id)), answer_rankings(position, mentioned, has_link, brands(is_mine))");
  if (error || !answers) {
    console.warn("refreshSnapshots failed", error);
    return;
  }

  const today = new Date().toISOString().slice(0, 10);
  const buckets = new Map<string, Bucket>();
  const bucket = (id: string) => {
    if (!buckets.has(id)) buckets.set(id, { answers: 0, mineMentions: 0, minePositions: [], mineLinks: 0 });
    return buckets.get(id)!;
  };

  for (const answer of answers as unknown as {
    questions: { topics: { domain_id: string } | null } | null;
    answer_rankings: { position: number | null; mentioned: boolean; has_link: boolean; brands: { is_mine: boolean } | null }[];
  }[]) {
    const domainId = answer.questions?.topics?.domain_id;
    const mine = answer.answer_rankings.find((r) => r.brands?.is_mine);
    for (const b of domainId ? [bucket("all"), bucket(domainId)] : [bucket("all")]) {
      b.answers++;
      if (mine?.mentioned) {
        b.mineMentions++;
        if (mine.position !== null) b.minePositions.push(mine.position);
      }
      if (mine?.has_link) b.mineLinks++;
    }
  }

  for (const [domainId, b] of buckets) {
    const avgPos = b.minePositions.length
      ? b.minePositions.reduce((a, c) => a + c, 0) / b.minePositions.length
      : 0;
    const mentionRate = b.answers ? (b.mineMentions / b.answers) * 100 : 0;
    const linkRate = b.answers ? (b.mineLinks / b.answers) * 100 : 0;

    await computeSnapshot(supabase, today, domainId, "mine_avg_position", Number(avgPos.toFixed(2)));
    await computeSnapshot(supabase, today, domainId, "mine_mention_rate", Number(mentionRate.toFixed(2)));
    await computeSnapshot(supabase, today, domainId, "mine_link_rate", Number(linkRate.toFixed(2)));
  }
}
