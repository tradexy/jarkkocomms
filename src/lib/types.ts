export type Quote = {
  symbol: string;
  name: string;
  currency: string;
  exchange: string;
  price: number | null;
  previous: number | null;
  change: number | null;
  changePercent: number | null;
  dayHigh: number | null;
  dayLow: number | null;
  week52High: number | null;
  week52Low: number | null;
  volume: number | null;
  marketTime: number;
  timezone: string;
  sparkline: number[];
};

export type ChartPoint = {
  time: number;
  close: number;
  high: number;
  low: number;
  volume: number;
};

export type ChartSeries = Quote & {
  range: string;
  interval: string;
  source: "yahoo" | "sketch";
  points: ChartPoint[];
};

export type AlertRule = {
  id: string;
  symbol: string;
  direction: "above" | "below";
  price: number;
  createdAt: number;
  triggeredAt?: number;
};

export type RangeKey = "1d" | "5d" | "1mo" | "3mo" | "1y" | "5y";

export type DeskCurrency = "USD" | "EUR" | "GBP" | "JPY" | "CHF";

export type FxBook = {
  base: "USD";
  rates: Partial<Record<DeskCurrency, number>>;
  source: string;
  fetchedAt: number;
};
