import { postJson } from './http.js';

// Gemini with Google Search grounding — the closest proxy to Google's AI answers.
export function geminiEngine(env) {
  return {
    id: 'gemini',
    label: 'Gemini',
    model: env.GEMINI_MODEL || 'gemini-2.5-flash',
    async ask(prompt) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(this.model)}:generateContent`;
      const data = await postJson(url, {
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        tools: [{ google_search: {} }],
      }, { 'x-goog-api-key': env.GEMINI_API_KEY });
      const cand = (data.candidates || [])[0] || {};
      const text = (cand.content?.parts || []).map((p) => p.text || '').join('');
      // Grounding URIs are Google redirect links; the title carries the source domain.
      const citations = (cand.groundingMetadata?.groundingChunks || [])
        .filter((c) => c.web)
        .map((c) => ({ url: /\./.test(c.web.title || '') && !/\s/.test(c.web.title) ? `https://${c.web.title}` : c.web.uri, title: c.web.title }));
      return { text, citations };
    },
  };
}
