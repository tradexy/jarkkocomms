import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { DeskTools } from "./components/DeskTools";
import { PriceChart } from "./components/PriceChart";
import { Sparkline } from "./components/Sparkline";
import { CATEGORY_LABEL, INSTRUMENTS, SYMBOLS, type Category, instrumentBySymbol } from "./data/instruments";
import { loadChart, loadFx, loadQuotes } from "./lib/api";
import { crackSpread321, formatClock, formatPercent, formatStamp, formatVolume, tone } from "./lib/format";
import { DESK_CURRENCIES, displayUnit, formatMoney, formatSigned, fromDisplay, localSpark, toDisplay } from "./lib/money";
import { loadAlerts, loadCachedQuotes, loadCurrency, loadWatchlist, saveAlerts, saveCachedQuotes, saveCurrency, saveWatchlist } from "./lib/storage";
import { synthesizeHistory } from "./lib/sketch";
import type { AlertRule, ChartPoint, ChartSeries, DeskCurrency, Quote, RangeKey } from "./lib/types";

const RANGES: { key: RangeKey; label: string }[] = [
  { key: "1d", label: "1D" },
  { key: "5d", label: "5D" },
  { key: "1mo", label: "1M" },
  { key: "3mo", label: "3M" },
  { key: "1y", label: "1Y" },
  { key: "5y", label: "5Y" },
];

function bySymbol(quotes: Quote[]) {
  return new Map(quotes.map((quote) => [quote.symbol, quote]));
}

export default function App() {
  const cached = loadCachedQuotes();
  const [quotes, setQuotes] = useState<Quote[]>(cached?.quotes ?? []);
  const [fetchedAt, setFetchedAt] = useState<number | null>(cached?.fetchedAt ?? null);
  const [stale, setStale] = useState(Boolean(cached?.quotes.length));
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState("CL=F");
  const [range, setRange] = useState<RangeKey>("1mo");
  const [chart, setChart] = useState<ChartSeries | null>(null);
  const [overlay, setOverlay] = useState<ChartPoint[]>([]);
  const [filter, setFilter] = useState<Category | "all">("all");
  const [query, setQuery] = useState("");
  const [watchlist, setWatchlist] = useState<string[]>(loadWatchlist);
  const [alerts, setAlerts] = useState<AlertRule[]>(loadAlerts);
  const [alertPrice, setAlertPrice] = useState("");
  const [alertDirection, setAlertDirection] = useState<AlertRule["direction"]>("above");
  const [currency, setCurrency] = useState<DeskCurrency>(loadCurrency);
  const [rates, setRates] = useState<Partial<Record<DeskCurrency, number>>>({ USD: 1 });
  const [now, setNow] = useState(Date.now());
  const alertsRef = useRef(alerts);
  alertsRef.current = alerts;

  const quoteMap = useMemo(() => bySymbol(quotes), [quotes]);
  const selectedQuote = quoteMap.get(selected);
  const selectedInstrument = instrumentBySymbol(selected);
  const rate = rates[currency] ?? 1;
  const unit = selectedInstrument?.unit;
  const money = (native: number | null | undefined, symbol?: string) =>
    formatMoney(native, symbol ? instrumentBySymbol(symbol)?.unit : unit, currency, rate);
  const signed = (native: number | null | undefined, symbol?: string) =>
    formatSigned(native, symbol ? instrumentBySymbol(symbol)?.unit : "USD / bbl", currency, rate);

  useEffect(() => {
    const tick = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(tick);
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadFx()
      .then((book) => {
        if (!cancelled) setRates({ USD: 1, ...book.rates });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function refresh() {
      try {
        const payload = await loadQuotes(SYMBOLS);
        if (cancelled) return;
        setQuotes(payload.quotes);
        setFetchedAt(payload.fetchedAt);
        setStale(false);
        saveCachedQuotes(payload.quotes, payload.fetchedAt);
        setError(payload.errors.length ? `Partial feed: ${payload.errors.map((item) => item.symbol).join(", ")}` : null);
        evaluateAlerts(payload.quotes);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load market data");
      }
    }
    refresh();
    const id = window.setInterval(refresh, 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadChart(selected, range)
      .then((series) => {
        if (!cancelled) setChart(series);
      })
      .catch(() => {
        if (cancelled) return;
        const quote = quoteMap.get(selected);
        const points = synthesizeHistory(quote, range);
        setChart(quote ? { ...quote, range, interval: "sketch", source: "sketch", points } : null);
      });

    const pair = selected === "CL=F" ? "BZ=F" : selected === "BZ=F" ? "CL=F" : null;
    if (pair) {
      loadChart(pair, range)
        .then((series) => {
          if (!cancelled) setOverlay(series.points);
        })
        .catch(() => {
          if (!cancelled) setOverlay(synthesizeHistory(quoteMap.get(pair), range));
        });
    } else {
      setOverlay([]);
    }

    return () => {
      cancelled = true;
    };
    // quoteMap is read only for sketch fallback after a failed fetch
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, range]);

  useEffect(() => saveWatchlist(watchlist), [watchlist]);
  useEffect(() => saveAlerts(alerts), [alerts]);
  useEffect(() => saveCurrency(currency), [currency]);

  function evaluateAlerts(nextQuotes: Quote[]) {
    const map = bySymbol(nextQuotes);
    const fired: string[] = [];
    const next = alertsRef.current.map((rule) => {
      if (rule.triggeredAt) return rule;
      const price = map.get(rule.symbol)?.price;
      if (price == null) return rule;
      const hit = rule.direction === "above" ? price >= rule.price : price <= rule.price;
      if (!hit) return rule;
      fired.push(`${instrumentBySymbol(rule.symbol)?.ticker ?? rule.symbol} ${rule.direction} ${formatMoney(rule.price, instrumentBySymbol(rule.symbol)?.unit, currency, rate)}`);
      return { ...rule, triggeredAt: Date.now() };
    });
    if (fired.length) {
      setAlerts(next);
      if ("Notification" in window && Notification.permission === "granted") {
        new Notification("JarkkoComms alert", { body: fired.join(" · ") });
      }
    }
  }

  function toggleWatch(symbol: string) {
    setWatchlist((current) =>
      current.includes(symbol) ? current.filter((item) => item !== symbol) : [...current, symbol],
    );
  }

  function addAlert(event: FormEvent) {
    event.preventDefault();
    const entered = Number(alertPrice);
    if (!Number.isFinite(entered) || entered <= 0) return;
    if ("Notification" in window && Notification.permission === "default") {
      void Notification.requestPermission();
    }
    setAlerts((current) => [
      {
        id: crypto.randomUUID(),
        symbol: selected,
        direction: alertDirection,
        price: fromDisplay(entered, selectedInstrument?.unit, currency, rate),
        createdAt: Date.now(),
      },
      ...current,
    ]);
    setAlertPrice("");
  }

  const wti = quoteMap.get("CL=F");
  const brent = quoteMap.get("BZ=F");
  const heating = quoteMap.get("HO=F");
  const gasoline = quoteMap.get("RB=F");
  const spread = wti?.price != null && brent?.price != null ? brent.price - wti.price : null;
  const crack = crackSpread321(wti?.price ?? null, gasoline?.price ?? null, heating?.price ?? null);
  const visible = INSTRUMENTS.filter((item) => {
    const hay = `${item.ticker} ${item.name} ${item.symbol}`.toLowerCase();
    return hay.includes(query.trim().toLowerCase()) && (filter === "all" || item.category === filter);
  });
  const tape = quotes.length ? [...quotes, ...quotes] : [];
  const chartPoints = chart?.points?.length ? chart.points : synthesizeHistory(selectedQuote, range);
  const overlayName = selected === "CL=F" ? "Brent" : selected === "BZ=F" ? "WTI" : undefined;

  return (
    <div className="app">
      <header className="masthead">
        <div className="brand">
          <div className="mark" aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M10 2c0 5-4.2 5.6-4.2 10a4.2 4.2 0 1 0 8.4 0C14.2 7.6 10 7 10 2Z" fill="#e4b25a" />
            </svg>
          </div>
          <div>
            <span className="eyebrow">Pit board</span>
            <h1>JarkkoComms</h1>
            <p>Oil complex and commodity futures desk</p>
          </div>
        </div>
        <div className="desk-tools">
          <div className="fx-switch" role="group" aria-label="Display currency">
            {DESK_CURRENCIES.map((item) => (
              <button
                key={item.code}
                className={`${currency === item.code ? "active" : ""} ${item.primary ? "" : "minor"}`}
                onClick={() => setCurrency(item.code)}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="live-pill">
            <span className={error ? "dot stale" : "dot"} />
            <span>{error ? "Feed issue" : stale ? "Cached" : "Live"}</span>
            <span className="clock">{formatClock(now)}</span>
            <span>NY</span>
          </div>
        </div>
      </header>

      {tape.length > 0 && (
        <div className="ticker" aria-hidden="true">
          <div className="ticker-track">
            {tape.map((quote, index) => (
              <div className="tick" key={`${quote.symbol}-${index}`}>
                <b>{instrumentBySymbol(quote.symbol)?.ticker ?? quote.symbol}</b>
                <span>{money(quote.price, quote.symbol)}</span>
                <span className={tone(quote.changePercent)}>{formatPercent(quote.changePercent)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <section className="hero">
        <button className="stat primary" onClick={() => setSelected("CL=F")}>
          <div className="kicker"><span>WTI crude</span><span>CL=F</span></div>
          <div className="value">{money(wti?.price, "CL=F")}</div>
          <div className={tone(wti?.changePercent)}>
            {signed(wti?.change, "CL=F")} · {formatPercent(wti?.changePercent)}
          </div>
          <small>{wti?.name ?? "Front-month futures"}</small>
        </button>
        <button className="stat" onClick={() => setSelected("BZ=F")}>
          <div className="kicker"><span>Brent</span><span>ICE</span></div>
          <div className="value">{money(brent?.price, "BZ=F")}</div>
          <div className={tone(brent?.changePercent)}>
            {signed(brent?.change, "BZ=F")} · {formatPercent(brent?.changePercent)}
          </div>
          <small>North Sea benchmark</small>
        </button>
        <div className="stat">
          <div className="kicker"><span>Brent–WTI</span><span>Spread</span></div>
          <div className="value">{money(spread, "CL=F")}</div>
          <div className={tone(spread)}>{spread == null ? "Waiting for both legs" : spread >= 0 ? "Brent premium" : "WTI premium"}</div>
          <small>Inter-crude differential</small>
        </div>
        <div className="stat">
          <div className="kicker"><span>3-2-1 crack</span><span>Refining</span></div>
          <div className="value">{money(crack, "CL=F")}</div>
          <div className={tone(crack)}>per barrel</div>
          <small>2 gasoline + 1 heating oil − 3 WTI</small>
        </div>
      </section>

      {error && <div className="banner">{error}. Retrying every 30 seconds.</div>}

      <div className="workspace">
        <section className="panel">
          <div className="panel-head">
            <h2>Price history</h2>
            <div className="ranges">
              {RANGES.map((item) => (
                <button key={item.key} className={item.key === range ? "chip active" : "chip"} onClick={() => setRange(item.key)}>
                  {item.label}
                </button>
              ))}
            </div>
          </div>
          <div className="chart-meta">
            <h3>
              {selectedInstrument?.name ?? selected} <span>{displayUnit(unit, currency)}</span>
            </h3>
            <span>
              {selectedQuote ? `${money(selectedQuote.price)} · ${formatPercent(selectedQuote.changePercent)}` : "Waiting for last print…"}
            </span>
          </div>
          <PriceChart
            points={chartPoints}
            overlay={overlayName ? overlay : []}
            overlayName={overlayName}
            quote={selectedQuote}
            unit={unit}
            currency={currency}
            rate={rate}
            source={chart?.source ?? (chartPoints.length ? "sketch" : undefined)}
          />
          <dl className="details">
            <div><dt>Session high</dt><dd>{money(selectedQuote?.dayHigh)}</dd></div>
            <div><dt>Session low</dt><dd>{money(selectedQuote?.dayLow)}</dd></div>
            <div>
              <dt>52-week</dt>
              <dd>{money(selectedQuote?.week52Low)} – {money(selectedQuote?.week52High)}</dd>
            </div>
            <div><dt>Volume</dt><dd>{formatVolume(selectedQuote?.volume)}</dd></div>
          </dl>
        </section>

        <aside className="side">
          <DeskTools
            symbol={selected}
            ticker={selectedInstrument?.ticker ?? selected}
            unit={unit}
            quote={selectedQuote}
            currency={currency}
            rate={rate}
          />
          <section className="panel">
            <h2>Watchlist</h2>
            {watchlist.map((symbol) => {
              const quote = quoteMap.get(symbol);
              const instrument = instrumentBySymbol(symbol);
              return (
                <button key={symbol} className="watch-row" onClick={() => setSelected(symbol)}>
                  <span>
                    <b>{instrument?.ticker ?? symbol}</b>
                    <div className="name">{instrument?.name}</div>
                  </span>
                  <span className={tone(quote?.changePercent)}>
                    {money(quote?.price, symbol)}
                    <div>{formatPercent(quote?.changePercent)}</div>
                  </span>
                </button>
              );
            })}
          </section>

          <section className="panel">
            <h2>Price alerts</h2>
            <p className="name">Notify when {selectedInstrument?.ticker ?? selected} crosses a {currency} level.</p>
            <form className="alert-form" onSubmit={addAlert}>
              <select value={alertDirection} onChange={(event) => setAlertDirection(event.target.value as AlertRule["direction"])}>
                <option value="above">Above</option>
                <option value="below">Below</option>
              </select>
              <input
                inputMode="decimal"
                placeholder={(() => {
                  const shown = toDisplay(selectedQuote?.price, unit, currency, rate);
                  return shown == null ? "Price" : String(Number(shown.toFixed(4)));
                })()}
                value={alertPrice}
                onChange={(event) => setAlertPrice(event.target.value)}
              />
              <button type="submit">Add alert</button>
            </form>
            {alerts.map((rule) => (
              <div className="alert-row" key={rule.id}>
                <span>
                  {instrumentBySymbol(rule.symbol)?.ticker ?? rule.symbol} {rule.direction} {money(rule.price, rule.symbol)}
                  <div className="name">{rule.triggeredAt ? `Hit ${formatStamp(rule.triggeredAt)}` : "Armed"}</div>
                </span>
                <button className="ghost" onClick={() => setAlerts((current) => current.filter((item) => item.id !== rule.id))}>
                  Remove
                </button>
              </div>
            ))}
          </section>
        </aside>
      </div>

      <div className="toolbar">
        <div className="filters">
          {(["all", "energy", "metals", "agriculture"] as const).map((key) => (
            <button key={key} className={filter === key ? "chip active" : "chip"} onClick={() => setFilter(key)}>
              {CATEGORY_LABEL[key]}
            </button>
          ))}
        </div>
        <input className="search" placeholder="Search crude, metals, grains…" value={query} onChange={(event) => setQuery(event.target.value)} />
      </div>

      <section className="grid">
        {visible.map((instrument) => {
          const quote = quoteMap.get(instrument.symbol);
          const watched = watchlist.includes(instrument.symbol);
          const spark = quote?.sparkline?.length ? quote.sparkline : localSpark(quote?.price ?? null, quote?.previous ?? null, quote?.dayLow ?? null, quote?.dayHigh ?? null);
          return (
            <article key={instrument.symbol} className={selected === instrument.symbol ? "card selected" : "card"}>
              <div className="card-top">
                <button className="ghost" onClick={() => setSelected(instrument.symbol)}>
                  <b>{instrument.ticker}</b>
                  <div className="name">{instrument.name}</div>
                </button>
                <button
                  className={watched ? "icon-btn active" : "icon-btn"}
                  onClick={() => toggleWatch(instrument.symbol)}
                  aria-label={watched ? "Remove from watchlist" : "Add to watchlist"}
                >
                  ★
                </button>
              </div>
              <button className="ghost" onClick={() => setSelected(instrument.symbol)}>
                <div className="price">{money(quote?.price, instrument.symbol)}</div>
                <div className={tone(quote?.changePercent)}>{formatPercent(quote?.changePercent)}</div>
              </button>
              <Sparkline values={spark} up={(quote?.changePercent ?? 0) >= 0} />
              <div className="name">{displayUnit(instrument.unit, currency)}</div>
            </article>
          );
        })}
      </section>

      <p className="footnote">
        Delayed futures, not for execution or advice.
        {fetchedAt ? ` Last pull ${formatStamp(fetchedAt)}.` : ""} ECB FX via Frankfurter.
      </p>
    </div>
  );
}
