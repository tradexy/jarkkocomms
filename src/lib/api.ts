import type { ChartSeries, FxBook, Quote, RangeKey } from "./types";

async function readJson<T>(path: string): Promise<T> {
  const response = await fetch(path);
  const body = await response.json();
  if (!response.ok) {
    throw new Error(body?.error || `Request failed (${response.status})`);
  }
  return body as T;
}

export async function loadQuotes(symbols: string[]) {
  const query = encodeURIComponent(symbols.join(","));
  return readJson<{ quotes: Quote[]; errors: { symbol: string; error: string }[]; fetchedAt: number }>(
    `/api/quotes?symbols=${query}`,
  );
}

export async function loadChart(symbol: string, range: RangeKey) {
  return readJson<ChartSeries>(`/api/chart?symbol=${encodeURIComponent(symbol)}&range=${range}`);
}

export async function loadFx() {
  return readJson<FxBook>("/api/fx");
}

export async function requestBrief(
  body: { prompt: string; model: string; context: unknown },
  key: string,
) {
  if (!key.trim()) {
    throw new Error("No DeepSeek key — desk stays free");
  }
  const headers: Record<string, string> = { "Content-Type": "application/json", "x-deepseek-key": key.trim() };
  const response = await fetch("/api/brief", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error || `Brief failed (${response.status})`);
  }
  return payload as { text: string; model: string };
}
