import type { ChartPoint, Quote, RangeKey } from "./types";

const RANGE_MS: Record<RangeKey, number> = {
  "1d": 86_400_000,
  "5d": 5 * 86_400_000,
  "1mo": 30 * 86_400_000,
  "3mo": 90 * 86_400_000,
  "1y": 365 * 86_400_000,
  "5y": 5 * 365 * 86_400_000,
};

export function synthesizeHistory(quote: Quote | undefined, range: RangeKey): ChartPoint[] {
  if (!quote || quote.price == null) return [];
  const price = quote.price;
  const now = Date.now();
  const span = RANGE_MS[range];
  const spark = (quote.sparkline ?? []).filter((value) => value != null);
  if (spark.length >= 3) {
    return spark.map((close, index) => ({
      time: now - span + (span * index) / Math.max(1, spark.length - 1),
      close,
      high: close,
      low: close,
      volume: 0,
    }));
  }
  const prev = quote.previous ?? price;
  const low = quote.dayLow ?? quote.week52Low ?? Math.min(prev, price);
  const high = quote.dayHigh ?? quote.week52High ?? Math.max(prev, price);
  const path = [prev, (prev + low) / 2, low, (low + high) / 2, high, (high + price) / 2, price];
  return path.map((close, index) => ({
    time: now - span + (span * index) / (path.length - 1),
    close,
    high: close,
    low: close,
    volume: 0,
  }));
}
