import type { EngineAnswer } from "../types";
import { postJson, uniq } from "./http";

export async function askOpenAI(prompt: string, key: string): Promise<EngineAnswer> {
  const data = await postJson(
    "https://api.openai.com/v1/responses",
    {
      model: process.env.OPENAI_MODEL || "gpt-4.1",
      tools: [{ type: "web_search_preview" }],
      input: prompt,
    },
    { authorization: `Bearer ${key}` },
  );
  let text = "";
  const cites: string[] = [];
  for (const item of data.output ?? []) {
    if (item.type !== "message") continue;
    for (const c of item.content ?? []) {
      if (c.type !== "output_text") continue;
      text += c.text + "\n";
      for (const a of c.annotations ?? []) if (a.type === "url_citation") cites.push(a.url);
    }
  }
  return { text: text.trim(), citations: uniq(cites) };
}
