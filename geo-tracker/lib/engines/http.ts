export async function postJson(url: string, body: unknown, headers: Record<string, string>, timeoutMs = 90000) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status} ${text.slice(0, 200)}`);
  return JSON.parse(text);
}

export const uniq = (a: string[]) => [...new Set(a.filter(Boolean))];
