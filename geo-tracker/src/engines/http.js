// Shared fetch helper with timeout and retry on 429/5xx.
export async function postJson(url, body, headers = {}, { retries = 3, timeoutMs = 180000 } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...headers },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });
      const text = await res.text();
      if (res.ok) return JSON.parse(text);
      lastErr = new Error(`HTTP ${res.status}: ${text.slice(0, 400)}`);
      if (res.status !== 429 && res.status < 500) throw lastErr;
      const retryAfter = Number(res.headers.get('retry-after')) || 0;
      await sleep(Math.max(retryAfter * 1000, 2000 * 2 ** attempt));
    } catch (err) {
      lastErr = err;
      if (/^HTTP 4(?!29)/.test(err.message)) throw err;
      if (attempt < retries) await sleep(2000 * 2 ** attempt);
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastErr;
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
