import type { PageContent } from "./types";

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

export function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m);
}

const stripTags = (s: string) => decodeEntities(s.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
export const countWords = (s: string) => (s.trim() ? s.trim().split(/\s+/).length : 0);

function meta(html: string, name: string): string {
  const re = new RegExp(`<meta[^>]+(?:name|property)=["']${name}["'][^>]*content=["']([^"']*)["']`, "i");
  const re2 = new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:name|property)=["']${name}["']`, "i");
  return decodeEntities((re.exec(html) ?? re2.exec(html))?.[1] ?? "").trim();
}

function collectTypes(node: unknown, out: Set<string>) {
  if (Array.isArray(node)) return node.forEach((n) => collectTypes(n, out));
  if (node && typeof node === "object") {
    const o = node as Record<string, unknown>;
    const t = o["@type"];
    if (typeof t === "string") out.add(t);
    else if (Array.isArray(t)) t.forEach((x) => typeof x === "string" && out.add(x));
    Object.values(o).forEach((v) => collectTypes(v, out));
  }
}

/** Pure function: HTML -> readable content + structure signals. */
export function extractContent(html: string, pageUrl = ""): PageContent {
  const schemaTypes = new Set<string>();
  let dateModified: string | undefined;
  for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const j = JSON.parse(m[1]);
      collectTypes(j, schemaTypes);
      const d = JSON.stringify(j).match(/"dateModified"\s*:\s*"([^"]+)"/)?.[1];
      if (d) dateModified ??= d;
    } catch {}
  }
  dateModified ??= meta(html, "article:modified_time") || /<time[^>]+datetime=["']([^"']+)["']/i.exec(html)?.[1];

  const title = decodeEntities(/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? "").trim();
  const description = meta(html, "description") || meta(html, "og:description");

  // body without non-content blocks
  let body = /<body[^>]*>([\s\S]*)<\/body>/i.exec(html)?.[1] ?? html;
  body = body
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript|svg|template|iframe)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<(nav|footer|aside)[\s\S]*?<\/\1>/gi, " ");

  const headings = [...body.matchAll(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi)]
    .map((m) => ({ level: Number(m[1]), text: stripTags(m[2]) }))
    .filter((h) => h.text);

  const tableCount = (body.match(/<table[\s>]/gi) ?? []).length;
  const listCount = (body.match(/<(ul|ol)[\s>]/gi) ?? []).length;
  const faqCount =
    (body.match(/<(details|summary)[\s>]/gi) ?? []).length / 2 +
    headings.filter((h) => /\?\s*$|^(מה|איך|למה|האם|כמה|מתי|איפה|what|how|why|is|are|can|does|do|when|which)\b/i.test(h.text)).length;

  // block-level elements -> line breaks so paragraphs stay separate
  const text = decodeEntities(
    body
      .replace(/<\/(p|div|section|article|li|tr|h[1-6]|blockquote|br)\s*>|<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  )
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n");

  let host = "";
  try { host = new URL(pageUrl).hostname.replace(/^www\./, ""); } catch {}
  const externalLinks = [...body.matchAll(/<a[^>]+href=["'](https?:\/\/[^"']+)["']/gi)].filter((m) => {
    try { return !host || !new URL(m[1]).hostname.replace(/^www\./, "").endsWith(host); } catch { return false; }
  }).length;

  return {
    title, description, headings, text,
    wordCount: countWords(text),
    faqCount: Math.round(faqCount),
    tableCount, listCount,
    hasNumbers: /\d+([.,]\d+)?\s?(%|₪|\$|€|אחוז|ש"ח|users|customers|לקוחות|משתמשים)/i.test(text) || /\b\d{2,}\b/.test(text),
    schemaTypes: [...schemaTypes],
    dateModified,
    externalLinks,
  };
}

/** Content from plain/markdown text (e.g. a rendered page returned by a crawler). */
export function contentFromText(text: string, title = ""): PageContent {
  const headings = [...text.matchAll(/^(#{1,6})\s+(.+)$/gm)].map((m) => ({ level: m[1].length, text: m[2].trim() }));
  const clean = text.replace(/^#{1,6}\s+/gm, "").trim();
  return {
    title, description: "", headings, text: clean, wordCount: countWords(clean),
    faqCount: headings.filter((h) => /\?\s*$/.test(h.text)).length,
    tableCount: (text.match(/^\|.+\|$/gm) ?? []).length ? 1 : 0,
    listCount: (text.match(/^\s*[-*]\s+/gm) ?? []).length ? 1 : 0,
    hasNumbers: /\b\d{2,}\b/.test(text), schemaTypes: [], externalLinks: 0,
  };
}

/** Signals that the visible content is built client-side. */
export function looksLikeSpa(html: string, c: PageContent): boolean {
  const shell = /<div[^>]+id=["'](root|app|__next|__nuxt)["'][^>]*>\s*<\/div>/i.test(html);
  const scripts = (html.match(/<script[\s>]/gi) ?? []).length;
  const emptyNext = /id=["']__NEXT_DATA__["']/.test(html) && c.wordCount < 80;
  return shell || emptyNext || (c.wordCount < 60 && scripts >= 3);
}

export function pageType(c: PageContent, url: string): "comparison" | "guide" | "product" | "faq" | "blog" | "other" {
  const s = `${url} ${c.title} ${c.headings.map((h) => h.text).join(" ")}`.toLowerCase();
  if (/\bvs\b|versus|compar|alternativ|השוואה|מול |חלופות/.test(s)) return "comparison";
  if (c.faqCount >= 4 || /faq|שאלות נפוצות/.test(s)) return "faq";
  if (/guide|how to|tutorial|מדריך|איך /.test(s)) return "guide";
  if (/blog|\/post|\/article|מאמר/.test(s)) return "blog";
  if (/pricing|product|features|מחיר|מוצר|תכונות/.test(s)) return "product";
  return "other";
}
