export type EngineId =
  | "openai"
  | "perplexity"
  | "gemini"
  | "claude"
  | "google_aio"
  | "google_aimode";

export const ENGINES: { id: EngineId; label: string }[] = [
  { id: "openai", label: "ChatGPT" },
  { id: "perplexity", label: "Perplexity" },
  { id: "gemini", label: "Gemini" },
  { id: "claude", label: "Claude" },
  { id: "google_aio", label: "Google AI Overview" },
  { id: "google_aimode", label: "Google AI Mode" },
];

export interface Competitor {
  name: string;
  domain: string;
}

export interface Settings {
  brand: string;
  domain: string;
  competitors: Competitor[];
  prompts: string[];
  demo: boolean;
  keys: Partial<Record<"openai" | "perplexity" | "gemini" | "anthropic" | "apify", string>>;
}

export interface EngineAnswer {
  text: string;
  citations: string[];
}

export interface Presence {
  mentioned: boolean;
  linked: boolean;
  /** 1-based place of the first matching citation, if any */
  rank?: number;
}

export interface Cell {
  engine: EngineId;
  prompt: string;
  status: "ok" | "error" | "skipped";
  error?: string;
  citations: string[];
  me: Presence;
  competitors: Record<string, Presence>; // key = competitor domain
}

export interface RunResult {
  startedAt: string;
  brand: string;
  domain: string;
  competitors: Competitor[];
  prompts: string[];
  engines: EngineId[];
  cells: Cell[];
}

export interface Recommendation {
  priority: "high" | "medium" | "low";
  title: string;
  detail?: string;
}
