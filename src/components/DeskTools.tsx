import { useEffect, useMemo, useRef, useState } from "react";
import { isBarrelContract, positionPnl, projectionBand, shockPrice } from "../lib/desk";
import { formatPercent, tone } from "../lib/format";
import { formatMoney, fromDisplay, toDisplay } from "../lib/money";
import type { DeskCurrency, Quote } from "../lib/types";

type Props = {
  symbol: string;
  ticker: string;
  unit?: string;
  quote?: Quote;
  currency: DeskCurrency;
  rate: number;
};

const SIZE_KEY = "jarkkocomms-size";

export function DeskTools({ symbol, ticker, unit, quote, currency, rate }: Props) {
  const barrels = isBarrelContract(symbol);
  const last = quote?.price ?? null;
  const lastDisplay = toDisplay(last, barrels ? "USD / bbl" : unit, currency, rate);
  const [size, setSize] = useState(() => {
    try {
      return localStorage.getItem(SIZE_KEY) ?? (barrels ? "1000" : "100000");
    } catch {
      return barrels ? "1000" : "100000";
    }
  });
  const [target, setTarget] = useState("");

  useEffect(() => {
    localStorage.setItem(SIZE_KEY, size);
  }, [size]);

  const primed = useRef("");
  useEffect(() => {
    if (lastDisplay == null) return;
    if (currency !== "USD" && rate === 1) return;
    const key = `${symbol}:${currency}:${rate.toFixed(6)}`;
    if (primed.current === key) return;
    setTarget(String(Number(lastDisplay.toFixed(3))));
    primed.current = key;
  }, [symbol, currency, lastDisplay, rate]);

  const qty = Number(size);
  const targetNative = fromDisplay(Number(target), barrels ? "USD / bbl" : unit, currency, rate);
  const band = projectionBand(quote);

  const scenarios = useMemo(() => {
    if (last == null || !Number.isFinite(qty) || qty <= 0) return [];
    const rows = [
      { label: "−5%", price: shockPrice(last, -5) },
      { label: "+5%", price: shockPrice(last, 5) },
    ];
    if (Number.isFinite(targetNative) && targetNative > 0) {
      rows.push({ label: "Target", price: targetNative });
    }
    return rows.map((row) => ({
      ...row,
      pnl: barrels ? positionPnl(last, row.price, qty) : positionPnl(last, row.price, qty / last),
    }));
  }, [barrels, last, qty, targetNative]);

  return (
    <section className="panel">
      <h2>Position sketch</h2>
      <p className="name">
        {barrels
          ? `What-if on ${ticker} in barrels. P&L is notional only.`
          : `What-if notional on ${ticker} in ${currency}.`}
      </p>
      <div className="alert-form desk-form">
        <label>
          {barrels ? "Barrels" : `${currency} notional`}
          <input inputMode="decimal" value={size} onChange={(event) => setSize(event.target.value)} />
        </label>
        <label>
          Target
          <input inputMode="decimal" value={target} onChange={(event) => setTarget(event.target.value)} />
        </label>
      </div>
      <div className="scenario-grid">
        {scenarios.map((row) => (
          <div key={row.label}>
            <dt>{row.label}</dt>
            <dd>{formatMoney(row.price, barrels ? "USD / bbl" : unit, currency, rate)}</dd>
            <dd className={tone(row.pnl)}>{formatMoney(row.pnl, "USD / bbl", currency, rate)}</dd>
          </div>
        ))}
      </div>

      <h3 className="subhead">Range illustration</h3>
      <p className="name">Last print against the 52-week band and a ±5% path. Not a forecast.</p>
      {band ? (
        <dl className="details compact">
          <div>
            <dt>−5%</dt>
            <dd className="down">{formatMoney(band.down5, barrels ? "USD / bbl" : unit, currency, rate)}</dd>
          </div>
          <div>
            <dt>+5%</dt>
            <dd className="up">{formatMoney(band.up5, barrels ? "USD / bbl" : unit, currency, rate)}</dd>
          </div>
          <div>
            <dt>52w low</dt>
            <dd>
              {formatMoney(band.rangeLow, barrels ? "USD / bbl" : unit, currency, rate)}
              <div className={tone(band.toLowPct)}>{formatPercent(band.toLowPct)}</div>
            </dd>
          </div>
          <div>
            <dt>52w high</dt>
            <dd>
              {formatMoney(band.rangeHigh, barrels ? "USD / bbl" : unit, currency, rate)}
              <div className={tone(band.toHighPct)}>{formatPercent(band.toHighPct)}</div>
            </dd>
          </div>
        </dl>
      ) : (
        <p className="name">Using last print as soon as the tape is up.</p>
      )}
    </section>
  );
}
