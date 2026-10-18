import { postJson } from './http.js';

export function perplexityEngine(env) {
  return {
    id: 'perplexity',
    label: 'Perplexity',
    model: env.PERPLEXITY_MODEL || 'sonar',
    async ask(prompt) {
      const data = await postJson('https://api.perplexity.ai/chat/completions', {
        model: this.model,
        messages: [{ role: 'user', content: prompt }],
        web_search_options: { user_location: { country: 'IL' } },
      }, { authorization: `Bearer ${env.PERPLEXITY_API_KEY}` });
      const text = data.choices?.[0]?.message?.content || '';
      const citations = data.search_results?.length
        ? data.search_results.map((r) => ({ url: r.url, title: r.title }))
        : (data.citations || []).map((url) => ({ url, title: '' }));
      return { text, citations };
    },
  };
}
