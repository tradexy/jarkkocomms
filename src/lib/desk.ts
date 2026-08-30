import type { Quote } from "./types";

export function isBarrelContract(symbol: string) {
  return symbol === "CL=F" || symbol === "BZ=F";
}

export function positionPnl(last: number, target: number, quantity: number) {
  return (target - last) * quantity;
}

export function shockPrice(last: number, percent: number) {
  return last * (1 + percent / 100);
}

export function projectionBand(quote: Quote | undefined) {
  if (!quote || quote.price == null) return null;
  const last = quote.price;
  const low = quote.week52Low ?? last * 0.85;
  const high = quote.week52High ?? last * 1.15;
  return {
    last,
    down5: shockPrice(last, -5),
    up5: shockPrice(last, 5),
    rangeLow: low,
    rangeHigh: high,
    toLowPct: ((low - last) / last) * 100,
    toHighPct: ((high - last) / last) * 100,
  };
}
