import { postJson } from './http.js';

const API = 'https://api.anthropic.com/v1/messages';

function headers(env) {
  return {
    'x-api-key': env.ANTHROPIC_API_KEY,
    'anthropic-version': '2023-06-01',
    // Server-side fallback: if the request is declined, the API reroutes it instead of failing.
    'anthropic-beta': 'server-side-fallback-2026-07-01',
  };
}

export async function claudeMessage(env, body) {
  return postJson(API, { fallbacks: 'default', ...body }, headers(env));
}

// Claude with the server-side web search tool, located in Israel.
export function anthropicEngine(env) {
  return {
    id: 'claude',
    label: 'Claude',
    model: env.ANTHROPIC_MODEL || 'claude-opus-5-5',
    async ask(prompt) {
      const messages = [{ role: 'user', content: prompt }];
      let data;
      // Long web-search turns may return pause_turn; send the partial turn back to let it finish.
      for (let i = 0; i < 4; i++) {
        data = await claudeMessage(env, {
          model: this.model,
          max_tokens: 16000,
          output_config: { effort: 'medium' },
          messages,
          tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: 5, user_location: { type: 'approximate', country: 'IL' } }],
        });
        if (data.stop_reason !== 'pause_turn') break;
        messages.push({ role: 'assistant', content: data.content });
      }
      if (data.stop_reason === 'refusal') throw new Error(`Claude declined: ${data.stop_details?.category || 'refusal'}`);
      let text = '';
      const citations = [];
      for (const block of data.content || []) {
        if (block.type === 'text') {
          text += block.text;
          for (const c of block.citations || []) if (c.url) citations.push({ url: c.url, title: c.title });
        } else if (block.type === 'web_search_tool_result' && Array.isArray(block.content)) {
          for (const r of block.content) if (r.url) citations.push({ url: r.url, title: r.title, retrievedOnly: true });
        }
      }
      return { text, citations };
    },
  };
}
