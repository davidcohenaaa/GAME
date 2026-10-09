import type { EngineAnswer } from "../types";
import { postJson, uniq } from "./http";

export async function askGemini(prompt: string, key: string): Promise<EngineAnswer> {
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const data = await postJson(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      contents: [{ parts: [{ text: prompt }] }],
      tools: [{ google_search: {} }],
    },
    { "x-goog-api-key": key },
  );
  const cand = data.candidates?.[0];
  const text: string = (cand?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? "").join("");
  // Grounding links are Google redirect URLs; the chunk title is the source domain.
  const cites = (cand?.groundingMetadata?.groundingChunks ?? [])
    .map((c: { web?: { uri?: string; title?: string } }) => {
      const t = c.web?.title ?? "";
      return /^[\w.-]+\.[a-z]{2,}$/i.test(t) ? `https://${t}` : c.web?.uri ?? "";
    })
    .filter(Boolean) as string[];
  return { text, citations: uniq(cites) };
}
