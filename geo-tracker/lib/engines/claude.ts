import type { EngineAnswer } from "../types";
import { postJson, uniq } from "./http";

export async function askClaude(prompt: string, key: string): Promise<EngineAnswer> {
  const data = await postJson(
    "https://api.anthropic.com/v1/messages",
    {
      model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5",
      max_tokens: 2048,
      tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 3 }],
      messages: [{ role: "user", content: prompt }],
    },
    { "x-api-key": key, "anthropic-version": "2023-06-01" },
  );
  let text = "";
  const cites: string[] = [];
  for (const b of data.content ?? []) {
    if (b.type === "text") {
      text += b.text;
      for (const c of b.citations ?? []) if (c.url) cites.push(c.url);
    } else if (b.type === "web_search_tool_result" && Array.isArray(b.content)) {
      for (const r of b.content) if (r.url) cites.push(r.url);
    }
  }
  return { text: text.trim(), citations: uniq(cites) };
}
