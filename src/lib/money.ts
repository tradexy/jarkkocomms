import type { DeskCurrency } from "./types";

const MARK: Record<DeskCurrency, string> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  JPY: "¥",
  CHF: "Fr ",
};

export const DESK_CURRENCIES: { code: DeskCurrency; label: string; primary?: boolean }[] = [
  { code: "EUR", label: "EUR", primary: true },
  { code: "USD", label: "USD", primary: true },
  { code: "GBP", label: "GBP" },
  { code: "JPY", label: "JPY" },
  { code: "CHF", label: "CHF" },
];

function numberLocale(currency: DeskCurrency) {
  if (currency === "EUR") return "fi-FI";
  if (currency === "GBP") return "en-GB";
  if (currency === "CHF") return "de-CH";
  if (currency === "JPY") return "ja-JP";
  return "en-US";
}

function nativeToUsd(native: number, unit?: string) {
  return unit?.startsWith("¢") ? native / 100 : native;
}

export function toDisplay(native: number | null | undefined, unit: string | undefined, currency: DeskCurrency, rate: number) {
  if (native == null || Number.isNaN(native)) return null;
  const usd = nativeToUsd(native, unit);
  if (currency === "USD" && unit?.startsWith("¢")) return native;
  return usd * rate;
}

export function fromDisplay(display: number, unit: string | undefined, currency: DeskCurrency, rate: number) {
  if (currency === "USD" && unit?.startsWith("¢")) return display;
  const usd = display / (rate || 1);
  return unit?.startsWith("¢") ? usd * 100 : usd;
}

export function formatMoney(
  native: number | null | undefined,
  unit: string | undefined,
  currency: DeskCurrency,
  rate: number,
) {
  const value = toDisplay(native, unit, currency, rate);
  if (value == null) return "—";
  const centsMode = currency === "USD" && unit?.startsWith("¢");
  const abs = Math.abs(value);
  const digits = centsMode ? 2 : abs < 10 ? 3 : currency === "JPY" ? 0 : 2;
  const formatted = new Intl.NumberFormat(numberLocale(currency), {
    minimumFractionDigits: centsMode || currency === "JPY" ? (centsMode ? 2 : 0) : abs < 10 ? 3 : 2,
    maximumFractionDigits: digits === 3 ? 4 : digits,
  }).format(value);
  if (centsMode) return formatted;
  return `${MARK[currency]}${formatted}`;
}

export function formatSigned(
  native: number | null | undefined,
  unit: string | undefined,
  currency: DeskCurrency,
  rate: number,
) {
  const value = toDisplay(native, unit, currency, rate);
  if (value == null) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${formatMoney(native, unit, currency, rate)}`;
}

export function displayUnit(unit: string | undefined, currency: DeskCurrency) {
  if (!unit) return "";
  if (currency === "USD") return unit;
  if (unit.startsWith("¢")) return `${currency} / ${unit.slice(4) || "unit"}`;
  return unit.replace(/^USD/, currency);
}

export function formatDisplayAmount(value: number | null | undefined, currency: DeskCurrency, cents = false) {
  if (value == null || Number.isNaN(value)) return "—";
  const abs = Math.abs(value);
  const formatted = new Intl.NumberFormat(numberLocale(currency), {
    minimumFractionDigits: cents ? 2 : currency === "JPY" ? 0 : abs < 10 ? 3 : 2,
    maximumFractionDigits: cents ? 2 : currency === "JPY" ? 0 : abs < 10 ? 4 : 2,
  }).format(value);
  if (cents) return formatted;
  return `${MARK[currency]}${formatted}`;
}

export function localSpark(price: number | null, previous: number | null, low: number | null, high: number | null) {
  if (price == null) return [];
  const prev = previous ?? price;
  const floor = low ?? Math.min(prev, price);
  const cap = high ?? Math.max(prev, price);
  return [prev, (prev + floor) / 2, floor, (floor + cap) / 2, cap, (cap + price) / 2, price];
}
