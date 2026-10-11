// Per-brand visibility metrics computed from collected answers (shared by comparison and competitors).

export type MetricsBrand = { id: string; name: string; is_mine: boolean; website_url: string | null };

export type MetricsAnswer = {
  id: string;
  question_id: string;
  source: string;
  questions: { text?: string; topic_id: string; topics: { domain_id: string } | null } | null;
  answer_rankings: { brand_id: string; position: number | null; mentioned: boolean; has_link: boolean }[];
};

export type BrandRow = {
  id: string;
  brand: string;
  isMine: boolean;
  url: string;
  avgPosition: number;
  mentionRate: number;
  linkRate: number;
  answers: number;
};

export function answersInDomain<T extends MetricsAnswer>(answers: T[], domain: string) {
  return domain === "all" ? answers : answers.filter((a) => a.questions?.topics?.domain_id === domain);
}

/** Mention rate and link rate are out of all answers in scope; position averages only answers that mention the brand. */
export function computeBrandRows(brands: MetricsBrand[], answers: MetricsAnswer[], domain = "all"): BrandRow[] {
  const scoped = answersInDomain(answers, domain);

  return brands
    .map((b) => {
      let mentions = 0;
      let links = 0;
      const positions: number[] = [];
      for (const a of scoped) {
        const r = a.answer_rankings.find((x) => x.brand_id === b.id);
        if (!r) continue;
        if (r.mentioned) {
          mentions++;
          if (r.position !== null) positions.push(r.position);
        }
        if (r.has_link) links++;
      }
      const total = scoped.length;
      return {
        id: b.id,
        brand: b.name,
        isMine: b.is_mine,
        url: b.website_url ?? "",
        avgPosition: positions.length > 0 ? positions.reduce((x, y) => x + y, 0) / positions.length : 0,
        mentionRate: total > 0 ? Math.round((mentions / total) * 100) : 0,
        linkRate: total > 0 ? Math.round((links / total) * 100) : 0,
        answers: total,
      };
    })
    .sort((a, b) => {
      if (b.mentionRate !== a.mentionRate) return b.mentionRate - a.mentionRate;
      if (a.avgPosition === 0) return 1;
      if (b.avgPosition === 0) return -1;
      return a.avgPosition - b.avgPosition;
    });
}
