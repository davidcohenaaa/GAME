import { openaiEngine } from './openai.js';
import { geminiEngine } from './gemini.js';
import { anthropicEngine } from './anthropic.js';
import { perplexityEngine } from './perplexity.js';
import { compatibleEngine } from './openaiCompatible.js';
import { mockEngines } from './mock.js';

// Every engine with a key in .env is enabled.
export function availableEngines(env = process.env) {
  if (env.MOCK === '1') return mockEngines();
  const list = [];
  if (env.OPENAI_API_KEY) list.push(openaiEngine(env));
  if (env.GEMINI_API_KEY) list.push(geminiEngine(env));
  if (env.ANTHROPIC_API_KEY) list.push(anthropicEngine(env));
  if (env.PERPLEXITY_API_KEY) list.push(perplexityEngine(env));
  if (env.XAI_API_KEY) list.push(compatibleEngine({ id: 'grok', label: 'Grok', baseUrl: 'https://api.x.ai/v1', apiKey: env.XAI_API_KEY, model: env.XAI_MODEL || 'grok-4' }));
  if (env.DEEPSEEK_API_KEY) list.push(compatibleEngine({ id: 'deepseek', label: 'DeepSeek', baseUrl: 'https://api.deepseek.com', apiKey: env.DEEPSEEK_API_KEY, model: env.DEEPSEEK_MODEL || 'deepseek-chat' }));
  return list;
}
