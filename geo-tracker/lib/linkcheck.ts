import { assertPublicUrl } from "./ssrf";

export const BOTS = [
  { id: "GPTBot", label: "ChatGPT (אימון)", ua: "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.1; +https://openai.com/gptbot)" },
  { id: "OAI-SearchBot", label: "ChatGPT Search", ua: "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; OAI-SearchBot/1.0; +https://openai.com/searchbot" },
  { id: "ClaudeBot", label: "Claude", ua: "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ClaudeBot/1.0; +claudebot@anthropic.com)" },
  { id: "PerplexityBot", label: "Perplexity", ua: "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)" },
  { id: "Google-Extended", label: "Gemini (אימון)", ua: "" },
  { id: "Googlebot", label: "Google Search / AI Overview", ua: "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)" },
] as const;

interface Group {
  agents: string[];
  rules: { allow: boolean; path: string }[];
}

export function parseRobots(txt: string): Group[] {
  const groups: Group[] = [];
  let cur: Group | null = null;
  let lastWasAgent = false;
  for (const raw of txt.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, "").trim();
    const i = line.indexOf(":");
    if (i < 0) continue;
    const k = line.slice(0, i).trim().toLowerCase();
    const v = line.slice(i + 1).trim();
    if (k === "user-agent") {
      if (!cur || !lastWasAgent) {
        cur = { agents: [], rules: [] };
        groups.push(cur);
      }
      cur.agents.push(v.toLowerCase());
      lastWasAgent = true;
    } else if (k === "allow" || k === "disallow") {
      lastWasAgent = false;
      if (cur && v !== "" ) cur.rules.push({ allow: k === "allow", path: v });
    } else {
      lastWasAgent = false;
    }
  }
  return groups;
}

function ruleMatches(rulePath: string, path: string): boolean {
  const anchored = rulePath.endsWith("$");
  const body = (anchored ? rulePath.slice(0, -1) : rulePath)
    .split("*")
    .map((s) => s.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  return new RegExp("^" + body + (anchored ? "$" : "")).test(path);
}

export function isAllowedByRobots(groups: Group[], bot: string, path: string): boolean {
  const b = bot.toLowerCase();
  let matched = groups.filter((g) => g.agents.includes(b));
  if (!matched.length) matched = groups.filter((g) => g.agents.includes("*"));
  let best: { allow: boolean; len: number } | null = null;
  for (const g of matched) {
    for (const r of g.rules) {
      if (ruleMatches(r.path, path) && (!best || r.path.length > best.len || (r.path.length === best.len && r.allow))) {
        best = { allow: r.allow, len: r.path.length };
      }
    }
  }
  return best ? best.allow : true;
}

export interface BotResult {
  bot: string;
  label: string;
  robots: "allowed" | "blocked";
  /** actual fetch using the bot's User-Agent; null when not testable */
  fetchStatus: number | null;
  ok: boolean;
}

export interface LinkCheck {
  url: string;
  finalUrl: string;
  status: number;
  noindex: boolean;
  canonical?: string;
  title?: string;
  hasSchema: boolean;
  hasRobotsTxt: boolean;
  hasSitemap: boolean;
  bots: BotResult[];
  issues: string[];
}

const TIMEOUT = 10000;

async function safeFetch(url: string, ua: string, maxRedirects = 4) {
  let current = url;
  for (let i = 0; i <= maxRedirects; i++) {
    await assertPublicUrl(current);
    const res = await fetch(current, {
      redirect: "manual",
      signal: AbortSignal.timeout(TIMEOUT),
      headers: { "user-agent": ua || "Mozilla/5.0 (compatible; GEOTracker/1.0)", accept: "text/html,*/*" },
    });
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      current = new URL(res.headers.get("location")!, current).toString();
      continue;
    }
    return { res, finalUrl: current };
  }
  throw new Error("יותר מדי הפניות");
}

export async function checkLink(rawUrl: string): Promise<LinkCheck> {
  const url = /^[a-z]+:\/\//i.test(rawUrl) ? rawUrl : "https://" + rawUrl;
  const u = await assertPublicUrl(url);
  const issues: string[] = [];

  const { res, finalUrl } = await safeFetch(url, "");
  const html = (await res.text()).slice(0, 500_000);
  const xrobots = res.headers.get("x-robots-tag") || "";
  const metaRobots = /<meta[^>]+name=["']robots["'][^>]*content=["']([^"']+)["']/i.exec(html)?.[1] || "";
  const noindex = /noindex/i.test(xrobots + " " + metaRobots);
  const canonical = /<link[^>]+rel=["']canonical["'][^>]*href=["']([^"']+)["']/i.exec(html)?.[1];
  const title = /<title[^>]*>([^<]*)<\/title>/i.exec(html)?.[1]?.trim();
  const hasSchema = /application\/ld\+json/i.test(html);

  let robotsTxt = "";
  let hasRobotsTxt = false;
  try {
    const r = await safeFetch(new URL("/robots.txt", u).toString(), "");
    if (r.res.ok) {
      robotsTxt = await r.res.text();
      hasRobotsTxt = true;
    }
  } catch {}
  const groups = parseRobots(robotsTxt);
  const hasSitemap = /^\s*sitemap:/im.test(robotsTxt);
  const path = new URL(finalUrl).pathname + new URL(finalUrl).search;

  const bots: BotResult[] = await Promise.all(
    BOTS.map(async (b) => {
      const allowed = isAllowedByRobots(groups, b.id, path);
      let fetchStatus: number | null = null;
      if (b.ua) {
        try {
          fetchStatus = (await safeFetch(url, b.ua)).res.status;
        } catch {}
      }
      const ok = allowed && (fetchStatus === null || fetchStatus < 400);
      return { bot: b.id, label: b.label, robots: allowed ? "allowed" : "blocked", fetchStatus, ok } as BotResult;
    }),
  );

  if (res.status >= 400) issues.push(`הדף מחזיר שגיאה ${res.status}`);
  if (noindex) issues.push("הדף מסומן noindex – מנועים לא יציינו אותו");
  for (const b of bots) {
    if (b.robots === "blocked") issues.push(`robots.txt חוסם את ${b.bot}`);
    else if (b.fetchStatus !== null && b.fetchStatus >= 400) issues.push(`האתר מחזיר ${b.fetchStatus} ל-${b.bot} (חסימת WAF/CDN?)`);
  }
  if (!hasSchema) issues.push("אין נתוני Schema (JSON-LD) – קשה יותר למנועים להבין את הדף");
  if (!hasSitemap) issues.push("לא הוגדר sitemap ב-robots.txt");

  return { url, finalUrl, status: res.status, noindex, canonical, title, hasSchema, hasRobotsTxt, hasSitemap, bots, issues };
}
