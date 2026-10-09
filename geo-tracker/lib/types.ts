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

/* ---------- page reading ---------- */
export interface PageContent {
  title: string;
  description: string;
  headings: { level: number; text: string }[];
  text: string; // full readable text
  wordCount: number;
  faqCount: number;
  tableCount: number;
  listCount: number;
  hasNumbers: boolean;
  schemaTypes: string[];
  dateModified?: string;
  externalLinks: number;
}

export interface PageUnderstanding {
  source: "ai" | "heuristic";
  summary: string;
  audience: string;
  mainEntity: string;
  questionsAnswered: string[];
  unclear: string[];
  clarityScore: number; // 0-100
}

export interface PageRead {
  url: string;
  status: number;
  /** what a non-JS bot receives */
  raw: PageContent;
  /** after JS rendering, when available */
  rendered?: PageContent;
  renderer: "apify" | "none";
  spaSuspected: boolean;
  /** share of the real page text that a non-JS bot sees (0-1), when measurable */
  visibleRatio?: number;
  understanding: PageUnderstanding;
  notes: string[];
}

/* ---------- competitor analysis ---------- */
export interface PageProfile {
  url: string;
  title: string;
  type: "comparison" | "guide" | "product" | "faq" | "blog" | "other";
  words: number;
  h2s: string[];
  faq: number;
  tables: number;
  lists: number;
  hasNumbers: boolean;
  schemaTypes: string[];
  dateModified?: string;
  cited: number; // times cited in the run
  error?: string;
}

export interface Gap {
  prompt: string;
  winners: string[];
  theyDo: string[];
  weMiss: string[];
  plan: {
    pageTitle: string;
    outline: string[];
    faq: string[];
    data: string[];
    external: string[];
  };
  impact: "high" | "medium" | "low";
  effort: "high" | "medium" | "low";
}

export interface AnalysisResult {
  generatedAt: string;
  mode: "ai" | "facts";
  pagesRead: number;
  competitors: { name: string; domain: string; pages: PageProfile[] }[];
  me: PageProfile[];
  gaps: Gap[];
  warnings: string[];
}
