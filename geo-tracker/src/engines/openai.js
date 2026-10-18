import { postJson } from './http.js';

// OpenAI Responses API with the built-in web search tool, located in Israel.
export function openaiEngine(env) {
  return {
    id: 'chatgpt',
    label: 'ChatGPT',
    model: env.OPENAI_MODEL || 'gpt-5',
    async ask(prompt) {
      const data = await postJson('https://api.openai.com/v1/responses', {
        model: this.model,
        input: prompt,
        tools: [{ type: env.OPENAI_SEARCH_TOOL || 'web_search', user_location: { type: 'approximate', country: 'IL' } }],
      }, { authorization: `Bearer ${env.OPENAI_API_KEY}` });
      let text = '';
      const citations = [];
      for (const item of data.output || []) {
        if (item.type !== 'message') continue;
        for (const part of item.content || []) {
          if (part.type !== 'output_text') continue;
          text += part.text;
          for (const a of part.annotations || []) {
            if (a.type === 'url_citation') citations.push({ url: a.url, title: a.title });
          }
        }
      }
      return { text: text || data.output_text || '', citations };
    },
  };
}
