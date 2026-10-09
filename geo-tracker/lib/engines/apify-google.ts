import type { EngineAnswer } from "../types";
import { postJson, uniq } from "./http";

/**
 * Google AI Overview / AI Mode via an Apify SERP actor.
 * The actor id is configurable (APIFY_ACTOR). Output field names differ between
 * actors, so the parser looks for the common shapes defensively.
 */
export async function askGoogleAi(
  prompt: string,
  token: string,
  mode: "aio" | "aimode",
): Promise<EngineAnswer> {
  const actor = process.env.APIFY_ACTOR || "apify~google-search-scraper";
  const input: Record<string, unknown> = {
    queries: prompt,
    resultsPerPage: 10,
    maxPagesPerQuery: 1,
    languageCode: "he",
    countryCode: "il",
    ...(mode === "aimode" ? { aiMode: "aiModeOnly" } : { aiMode: "aiModeAndRegular" }),
  };
  const items = await postJson(
    `https://api.apify.com/v2/acts/${actor}/run-sync-get-dataset-items?token=${encodeURIComponent(token)}`,
    input,
    {},
    180000,
  );
  const item = Array.isArray(items) ? items[0] : items;
  const block = mode === "aimode" ? item?.aiModeResult ?? item?.aiMode : item?.aiOverview;
  if (!block) return { text: "", citations: [] };

  const text: string = typeof block === "string" ? block : block.text ?? block.content ?? block.answer ?? "";
  const rawSources: unknown[] = block.sources ?? block.references ?? block.links ?? block.citations ?? [];
  const cites = rawSources
    .map((s) => (typeof s === "string" ? s : (s as { url?: string; link?: string }).url ?? (s as { link?: string }).link ?? ""))
    .filter(Boolean) as string[];
  return { text, citations: uniq(cites) };
}
