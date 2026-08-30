import { useEffect, useMemo, useRef, useState } from "react";
import { isBarrelContract, positionPnl, projectionBand, shockPrice } from "../lib/desk";
import { formatPercent, tone } from "../lib/format";
import { fill, type Copy } from "../lib/i18n";
import { formatMoney, fromDisplay, toDisplay } from "../lib/money";
import type { DeskCurrency, Quote } from "../lib/types";

type Props = {
  symbol: string;
  ticker: string;
  unit?: string;
  quote?: Quote;
  currency: DeskCurrency;
  rate: number;
  copy: Copy;
};

const SIZE_KEY = "jarkkocomms-size";

export function DeskTools({ symbol, ticker, unit, quote, currency, rate, copy }: Props) {
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
      <h2>{copy.position}</h2>
      <p className="name">
        {barrels
          ? fill(copy.whatIfBarrels, { ticker })
          : fill(copy.whatIfNotional, { ticker, currency })}
      </p>
      <div className="alert-form desk-form">
        <label>
          {barrels ? copy.barrels : fill(copy.notional, { currency })}
          <input inputMode="decimal" value={size} onChange={(event) => setSize(event.target.value)} />
        </label>
        <label>
          {copy.target}
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

      <h3 className="subhead">{copy.rangeTitle}</h3>
      <p className="name">{copy.rangeNote}</p>
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
        <p className="name">{copy.usingLast}</p>
      )}
    </section>
  );
}
