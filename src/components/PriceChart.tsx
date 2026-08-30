import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatStamp } from "../lib/format";
import { displayUnit, formatDisplayAmount, formatMoney, toDisplay } from "../lib/money";
import type { ChartPoint, DeskCurrency, Quote } from "../lib/types";

type Props = {
  points: ChartPoint[];
  overlay?: ChartPoint[];
  overlayName?: string;
  quote?: Quote;
  unit?: string;
  currency: DeskCurrency;
  rate: number;
  source?: string;
};

function rail(
  label: string,
  low: number | null | undefined,
  high: number | null | undefined,
  price: number | null | undefined,
  unit: string | undefined,
  currency: DeskCurrency,
  rate: number,
) {
  if (low == null || high == null || price == null || high === low) return null;
  const pct = Math.min(100, Math.max(0, ((price - low) / (high - low)) * 100));
  return (
    <div className="rail-meter">
      <div className="rail-copy">
        <span>{label}</span>
        <b>{formatMoney(price, unit, currency, rate)}</b>
      </div>
      <div className="track" aria-hidden="true">
        <div className="fill" style={{ width: `${pct}%` }} />
        <i className="knob" style={{ left: `${pct}%` }} />
      </div>
      <div className="ends">
        <span>{formatMoney(low, unit, currency, rate)}</span>
        <span>{formatMoney(high, unit, currency, rate)}</span>
      </div>
    </div>
  );
}

export function PriceChart({ points, overlay, overlayName, quote, unit, currency, rate, source }: Props) {
  const cents = currency === "USD" && !!unit?.startsWith("¢");
  const data = points.map((point, index) => {
    const twin = overlay?.[Math.round((index / Math.max(1, points.length - 1)) * Math.max(0, (overlay?.length ?? 1) - 1))]?.close;
    return {
      time: point.time,
      closeFx: toDisplay(point.close, unit, currency, rate) ?? point.close,
      overlayFx: twin == null ? undefined : toDisplay(twin, unit, currency, rate) ?? twin,
      label: formatStamp(point.time),
    };
  });
  const rising = (data.at(-1)?.closeFx ?? 0) >= (data[0]?.closeFx ?? 0);
  const color = rising ? "#7dce8a" : "#e36a54";

  return (
    <div className="chart-stack">
      <div className="chart-frame">
        {data.length < 2 ? (
          <div className="chart-empty">Waiting for a print…</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="oilFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.34} />
                  <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="rgba(232, 196, 132, 0.07)" vertical={false} />
              <XAxis dataKey="label" hide />
              <YAxis
                domain={["auto", "auto"]}
                width={74}
                tick={{ fill: "#b8a888", fontSize: 11, fontFamily: "IBM Plex Mono" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(value: number) => formatDisplayAmount(value, currency, cents)}
              />
              <Tooltip
                contentStyle={{
                  background: "#16140f",
                  border: "1px solid #3a3426",
                  borderRadius: 12,
                  color: "#f6edd8",
                }}
                labelStyle={{ color: "#b8a888" }}
                formatter={(value, name) => [
                  formatDisplayAmount(Number(value), currency, cents),
                  name === "overlayFx" ? overlayName ?? "Overlay" : displayUnit(unit, currency) || "Last",
                ]}
              />
              <Area type="monotone" dataKey="closeFx" stroke={color} fill="url(#oilFill)" strokeWidth={2.4} name="Last" />
              {overlay && overlay.length > 1 && (
                <Line type="monotone" dataKey="overlayFx" stroke="#d4b072" strokeWidth={1.6} dot={false} strokeDasharray="5 4" name={overlayName} />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
      <div className="rails">
        {rail("Session range", quote?.dayLow, quote?.dayHigh, quote?.price, unit, currency, rate)}
        {rail("52-week range", quote?.week52Low, quote?.week52High, quote?.price, unit, currency, rate)}
      </div>
      <p className="chart-source">{source === "sketch" ? "Session sketch — live history paused" : "Front-month history"}</p>
    </div>
  );
}
