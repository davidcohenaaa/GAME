import type { EngineAnswer } from "../types";
import { postJson, uniq } from "./http";

export async function askPerplexity(prompt: string, key: string): Promise<EngineAnswer> {
  const data = await postJson(
    "https://api.perplexity.ai/chat/completions",
    {
      model: process.env.PERPLEXITY_MODEL || "sonar",
      messages: [{ role: "user", content: prompt }],
    },
    { authorization: `Bearer ${key}` },
  );
  const text: string = data.choices?.[0]?.message?.content ?? "";
  const cites: string[] = [
    ...(data.citations ?? []),
    ...((data.search_results ?? []).map((r: { url: string }) => r.url) as string[]),
  ];
  return { text, citations: uniq(cites) };
}
