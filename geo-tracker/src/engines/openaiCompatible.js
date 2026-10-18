import { postJson } from './http.js';

// Any chat-completions compatible API (Grok, DeepSeek). These answer from model knowledge, without citations.
export function compatibleEngine({ id, label, baseUrl, apiKey, model }) {
  return {
    id,
    label,
    model,
    async ask(prompt) {
      const data = await postJson(`${baseUrl}/chat/completions`, {
        model,
        messages: [{ role: 'user', content: prompt }],
      }, { authorization: `Bearer ${apiKey}` });
      return { text: data.choices?.[0]?.message?.content || '', citations: (data.citations || []).map((url) => ({ url, title: '' })) };
    },
  };
}
