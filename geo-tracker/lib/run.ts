import { buildCell } from "./analyze";
import { askClaude } from "./engines/claude";
import { askGemini } from "./engines/gemini";
import { askGoogleAi } from "./engines/apify-google";
import { askOpenAI } from "./engines/openai";
import { askPerplexity } from "./engines/perplexity";
import { mockAnswer } from "./mock";
import { getKey, isDemo as demoOn, type KeyName } from "./store";
import { ENGINES, type Cell, type EngineAnswer, type EngineId, type RunResult, type Settings } from "./types";

const KEY_FOR: Record<EngineId, KeyName> = {
  openai: "openai",
  perplexity: "perplexity",
  gemini: "gemini",
  claude: "anthropic",
  google_aio: "apify",
  google_aimode: "apify",
};


export function availableEngines(s: Settings): EngineId[] {
  return ENGINES.map((e) => e.id).filter((id) => demoOn(s) || getKey(s, KEY_FOR[id]));
}

function ask(engine: EngineId, prompt: string, s: Settings): Promise<EngineAnswer> {
  if (demoOn(s)) return Promise.resolve(mockAnswer(engine, prompt, s));
  const key = getKey(s, KEY_FOR[engine])!;
  switch (engine) {
    case "openai": return askOpenAI(prompt, key);
    case "perplexity": return askPerplexity(prompt, key);
    case "gemini": return askGemini(prompt, key);
    case "claude": return askClaude(prompt, key);
    case "google_aio": return askGoogleAi(prompt, key, "aio");
    case "google_aimode": return askGoogleAi(prompt, key, "aimode");
  }
}

export async function runAll(s: Settings, concurrency = 4): Promise<RunResult> {
  const engines = availableEngines(s);
  const jobs = s.prompts.flatMap((prompt) => engines.map((engine) => ({ prompt, engine })));
  const cells: Cell[] = new Array(jobs.length);
  const me = { brand: s.brand, domain: s.domain };
  let next = 0;

  async function worker() {
    while (next < jobs.length) {
      const i = next++;
      const { prompt, engine } = jobs[i];
      try {
        const answer = await ask(engine, prompt, s);
        cells[i] = buildCell(engine, prompt, answer, me, s.competitors);
      } catch (e) {
        cells[i] = {
          engine, prompt, status: "error", error: e instanceof Error ? e.message : String(e),
          citations: [], me: { mentioned: false, linked: false }, competitors: {},
        };
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, jobs.length) }, worker));

  return {
    startedAt: new Date().toISOString(),
    brand: s.brand,
    domain: s.domain,
    competitors: s.competitors,
    prompts: s.prompts,
    engines,
    cells,
  };
}
