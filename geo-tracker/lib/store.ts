import { promises as fs } from "fs";
import path from "path";
import type { AnalysisResult, RunResult, Settings } from "./types";

const DIR = path.join(process.cwd(), "data");

export const DEFAULT_SETTINGS: Settings = {
  brand: "",
  domain: "",
  competitors: [],
  prompts: [],
  demo: false,
  keys: {},
};

async function readJson<T>(file: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await fs.readFile(path.join(DIR, file), "utf8")) as T;
  } catch {
    return fallback;
  }
}

async function writeJson(file: string, data: unknown) {
  await fs.mkdir(DIR, { recursive: true });
  await fs.writeFile(path.join(DIR, file), JSON.stringify(data, null, 2));
}

export async function loadSettings(): Promise<Settings> {
  return { ...DEFAULT_SETTINGS, ...(await readJson<Partial<Settings>>("settings.json", {})) };
}

export const saveSettings = (s: Settings) => writeJson("settings.json", s);
export const loadRun = () => readJson<RunResult | null>("last-run.json", null);
export const saveRun = (r: RunResult) => writeJson("last-run.json", r);
export const loadAnalysis = () => readJson<AnalysisResult | null>("analysis.json", null);
export const saveAnalysis = (a: AnalysisResult) => writeJson("analysis.json", a);
export const isDemo = (s: Settings) => s.demo || process.env.MOCK === "1";

export type KeyName = keyof Settings["keys"];
const ENV: Record<KeyName, string> = {
  openai: "OPENAI_API_KEY",
  perplexity: "PERPLEXITY_API_KEY",
  gemini: "GEMINI_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
  apify: "APIFY_TOKEN",
};

export function getKey(s: Settings, name: KeyName): string | undefined {
  return s.keys[name] || process.env[ENV[name]] || undefined;
}
