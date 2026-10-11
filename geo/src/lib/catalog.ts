// Domains and AI sources shared by the server and the screens.
// Domain ids must match topics.domain_id in the database.

export const DOMAINS = [
  { id: "all", name: "כל התחומים" },
  { id: "car", name: "ביטוח רכב" },
  { id: "home", name: "ביטוח דירה" },
  { id: "health", name: "ביטוח בריאות" },
  { id: "life", name: "ביטוח חיים" },
  { id: "travel", name: "ביטוח נסיעות" },
  { id: "pension", name: "פנסיה וחיסכון" },
  { id: "service", name: "שירות ותביעות" },
];

export type SourceId = "chatgpt" | "gemini" | "claude" | "google";

export const SOURCES: { id: SourceId; name: string }[] = [
  { id: "chatgpt", name: "ChatGPT" },
  { id: "gemini", name: "Gemini" },
  { id: "claude", name: "Claude" },
  { id: "google", name: "Google AI Overview" },
];

export function sourceName(id: string) {
  return SOURCES.find((s) => s.id === id)?.name ?? id;
}

export function domainName(id: string) {
  return DOMAINS.find((d) => d.id === id)?.name ?? id;
}
