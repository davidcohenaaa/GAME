// Finds tracked brands in a real AI answer: whether each brand is mentioned, its rank by
// order of first appearance, and whether the answer links to the brand's website.

export type MatchBrand = {
  id: string;
  name: string;
  website_url: string | null;
  aliases: string[];
};

export type BrandMatch = {
  brand_id: string;
  mentioned: boolean;
  position: number | null;
  has_link: boolean;
};

const HEBREW = "֐-׿";

function normalize(text: string) {
  return text
    .replace(/[֑-ׇ]/g, "") // niqqud
    .replace(/[׳`’]/g, "'")
    .replace(/[״“”]/g, '"')
    .toLowerCase();
}

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Hebrew attaches one-letter prefixes to words ("ובהראל", "לכלל"). Long aliases accept them.
 * Short single-word aliases are common words too ("כלל", "מגדל"), so they accept only "ו"
 * (as in a list: "הראל, מגדל וכלל") to avoid matching "בכלל" ("at all").
 */
function aliasPattern(alias: string) {
  const a = normalize(alias.trim());
  const isHebrew = new RegExp(`[${HEBREW}]`).test(a);
  if (!isHebrew) return new RegExp(`(?<![a-z0-9])${escapeRegex(a)}(?![a-z0-9])`, "g");
  const short = !a.includes(" ") && a.length <= 4;
  const prefix = short ? "ו?" : "(?:ו|ש|ה|ב|ל|מ|כ|וה|וב|ול|ומ|שה|שב|של|מה|כש)?";
  return new RegExp(`(?<![${HEBREW}])${prefix}${escapeRegex(a)}(?![${HEBREW}])`, "g");
}

function firstIndex(text: string, aliases: string[]) {
  let best = -1;
  for (const alias of aliases) {
    if (!alias.trim()) continue;
    const m = aliasPattern(alias).exec(text);
    if (m && (best === -1 || m.index < best)) best = m.index;
  }
  return best;
}

function hostOf(value: string) {
  try {
    return new URL(value.includes("://") ? value : `https://${value}`).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

/** Collects host names from cited URLs/titles and from URLs written in the answer text. */
export function linkedHosts(text: string, citations: { url: string; title?: string | null | undefined }[]) {
  const hosts = new Set<string>();
  for (const c of citations) {
    const h = hostOf(c.url);
    if (h) hosts.add(h);
    // Gemini returns redirect URLs and puts the real domain in the title
    if (c.title && /^[\w.-]+\.[a-z]{2,}$/i.test(c.title.trim())) {
      const t = hostOf(c.title.trim());
      if (t) hosts.add(t);
    }
  }
  for (const m of text.matchAll(/https?:\/\/[^\s)\]"'<>]+|(?:www\.)[\w.-]+\.[a-z]{2,}/gi)) {
    const h = hostOf(m[0]);
    if (h) hosts.add(h);
  }
  return hosts;
}

export function matchBrands(
  answerText: string,
  citations: { url: string; title?: string | null | undefined }[],
  brands: MatchBrand[],
): BrandMatch[] {
  const text = normalize(answerText);
  const hosts = linkedHosts(answerText, citations);

  const found = brands.map((b) => {
    const aliases = b.aliases.length > 0 ? b.aliases : [b.name];
    const index = firstIndex(text, [b.name, ...aliases]);
    const site = b.website_url ? hostOf(b.website_url) : null;
    const hasLink = site ? [...hosts].some((h) => h === site || h.endsWith(`.${site}`)) : false;
    return { brand: b, index, hasLink };
  });

  const order = found
    .filter((f) => f.index >= 0)
    .sort((a, b) => a.index - b.index)
    .map((f) => f.brand.id);

  return found.map((f) => {
    const rank = order.indexOf(f.brand.id);
    return {
      brand_id: f.brand.id,
      mentioned: f.index >= 0,
      position: rank >= 0 ? rank + 1 : null,
      has_link: f.hasLink,
    };
  });
}
