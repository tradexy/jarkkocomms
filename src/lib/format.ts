const COMPACT = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

export function formatPercent(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

export function formatVolume(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return "—";
  return COMPACT.format(value);
}

export function formatClock(ms: number, timeZone = "America/New_York") {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone,
    hour12: false,
  }).format(new Date(ms));
}

export function formatStamp(ms: number, timeZone = "America/New_York") {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
    hour12: false,
  }).format(new Date(ms));
}

export function tone(value: number | null | undefined) {
  if (value == null || value === 0) return "flat";
  return value > 0 ? "up" : "down";
}

export function crackSpread321(wti: number | null, gasoline: number | null, heatingOil: number | null) {
  if (wti == null || gasoline == null || heatingOil == null) return null;
  return (2 * gasoline * 42 + heatingOil * 42 - 3 * wti) / 3;
}
