import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { DeskTools } from "./components/DeskTools";
import { PriceChart } from "./components/PriceChart";
import { SettingsPanel } from "./components/SettingsPanel";
import { Sparkline } from "./components/Sparkline";
import { VoiceBar } from "./components/VoiceBar";
import { INSTRUMENTS, SYMBOLS, instrumentBySymbol, instrumentName } from "./data/instruments";
import { loadChart, loadFx, loadQuotes, requestBrief } from "./lib/api";
import { crackSpread321, formatClock, formatPercent, formatStamp, formatVolume, tone } from "./lib/format";
import { COPY, detectLang, fill, saveLang, type Lang } from "./lib/i18n";
import type { LlmModelId, LlmProviderId } from "./lib/llm";
import { DESK_CURRENCIES, displayUnit, formatMoney, formatSigned, fromDisplay, localSpark, toDisplay } from "./lib/money";
import { listenOnce, parseVoiceCommand, recognitionSupported, speakText, speechSupported, stopSpeech } from "./lib/speech";
import {
  loadAlerts,
  loadCachedQuotes,
  loadCurrency,
  loadDeepSeekKey,
  loadLlmModel,
  loadLlmProvider,
  loadWatchlist,
  saveAlerts,
  saveCachedQuotes,
  saveCurrency,
  saveDeepSeekKey,
  saveLlmModel,
  saveLlmProvider,
  saveWatchlist,
} from "./lib/storage";
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
  const [offline, setOffline] = useState(typeof navigator !== "undefined" ? !navigator.onLine : false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState("CL=F");
  const [range, setRange] = useState<RangeKey>("1mo");
  const [chart, setChart] = useState<ChartSeries | null>(null);
  const [overlay, setOverlay] = useState<ChartPoint[]>([]);
  const [filter, setFilter] = useState<import("./data/instruments").Category | "all">("all");
  const [query, setQuery] = useState("");
  const [watchlist, setWatchlist] = useState<string[]>(loadWatchlist);
  const [alerts, setAlerts] = useState<AlertRule[]>(loadAlerts);
  const [alertPrice, setAlertPrice] = useState("");
  const [alertDirection, setAlertDirection] = useState<AlertRule["direction"]>("above");
  const [currency, setCurrency] = useState<DeskCurrency>(loadCurrency);
  const [rates, setRates] = useState<Partial<Record<DeskCurrency, number>>>({ USD: 1 });
  const [now, setNow] = useState(Date.now());
  const [lang, setLang] = useState<Lang>(detectLang);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [provider, setProvider] = useState<LlmProviderId>(loadLlmProvider);
  const [model, setModel] = useState<LlmModelId>(loadLlmModel);
  const [apiKey, setApiKey] = useState(loadDeepSeekKey);
  const [speaking, setSpeaking] = useState(false);
  const [listening, setListening] = useState(false);
  const [heard, setHeard] = useState("");
  const [brief, setBrief] = useState("");
  const [briefBusy, setBriefBusy] = useState(false);
  const [briefError, setBriefError] = useState<string | null>(null);
  const alertsRef = useRef(alerts);
  alertsRef.current = alerts;
  const copy = COPY[lang];

  const quoteMap = useMemo(() => bySymbol(quotes), [quotes]);
  const selectedQuote = quoteMap.get(selected);
  const selectedInstrument = instrumentBySymbol(selected);
  const rate = rates[currency] ?? 1;
  const unit = selectedInstrument?.unit;
  const money = (native: number | null | undefined, symbol?: string) =>
    formatMoney(native, symbol ? instrumentBySymbol(symbol)?.unit : unit, currency, rate);
  const signed = (native: number | null | undefined, symbol?: string) =>
    formatSigned(native, symbol ? instrumentBySymbol(symbol)?.unit : "USD / bbl", currency, rate);
  const named = (symbol: string) => instrumentName(instrumentBySymbol(symbol), lang);

  useEffect(() => {
    const tick = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(tick);
  }, []);

  useEffect(() => {
    const goOnline = () => setOffline(false);
    const goOffline = () => setOffline(true);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
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
        setOffline(false);
        saveCachedQuotes(payload.quotes, payload.fetchedAt);
        setError(payload.errors.length ? `${copy.partialFeed}: ${payload.errors.map((item) => item.symbol).join(", ")}` : null);
        evaluateAlerts(payload.quotes);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : copy.feedIssue);
          if (cached?.quotes.length || quotes.length) {
            setStale(true);
            setOffline(!navigator.onLine);
          }
        }
      }
    }
    refresh();
    const id = window.setInterval(refresh, 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, range]);

  useEffect(() => saveWatchlist(watchlist), [watchlist]);
  useEffect(() => saveAlerts(alerts), [alerts]);
  useEffect(() => saveCurrency(currency), [currency]);
  useEffect(() => saveLang(lang), [lang]);
  useEffect(() => saveLlmModel(model), [model]);
  useEffect(() => saveLlmProvider(provider), [provider]);

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
        new Notification("JarkkoComms", { body: fired.join(" · ") });
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

  function changeLang(next: Lang) {
    setLang(next);
    document.documentElement.lang = next === "fi" ? "fi" : "en";
  }

  function speakSelected() {
    if (!speechSupported()) return;
    const name = named(selected) || selected;
    const last = money(selectedQuote?.price, selected);
    const change = formatPercent(selectedQuote?.changePercent);
    const hel = formatClock(now, "Europe/Helsinki");
    const ny = formatClock(now, "America/New_York");
    const text =
      lang === "fi"
        ? `${name}, viimeisin ${last}, muutos ${change}, valuutta ${currency}. Helsinki ${hel}, New York ${ny}.`
        : `${name}, last ${last}, change ${change}, currency ${currency}. Helsinki ${hel}, New York ${ny}.`;
    setSpeaking(true);
    speakText(text, lang);
    window.setTimeout(() => setSpeaking(false), 8000);
  }

  function speakOil() {
    if (!speechSupported()) return;
    const wtiText = money(quoteMap.get("CL=F")?.price, "CL=F");
    const brentText = money(quoteMap.get("BZ=F")?.price, "BZ=F");
    const spreadVal =
      quoteMap.get("CL=F")?.price != null && quoteMap.get("BZ=F")?.price != null
        ? (quoteMap.get("BZ=F")?.price ?? 0) - (quoteMap.get("CL=F")?.price ?? 0)
        : null;
    const spreadText = money(spreadVal, "CL=F");
    const text =
      lang === "fi"
        ? `Öljy. WTI ${wtiText}, Brent ${brentText}, Brent–WTI-ero ${spreadText}.`
        : `Oil board. WTI ${wtiText}, Brent ${brentText}, Brent–WTI spread ${spreadText}.`;
    setSpeaking(true);
    speakText(text, lang);
    window.setTimeout(() => setSpeaking(false), 8000);
  }

  async function onListen() {
    if (!recognitionSupported() || listening) return;
    setListening(true);
    try {
      const transcript = await listenOnce(lang);
      setHeard(transcript);
      const command = parseVoiceCommand(transcript);
      if (command?.type === "select") setSelected(command.symbol);
      if (command?.type === "watch") toggleWatch(command.symbol);
      if (command?.type === "fx") setCurrency(command.currency);
      if (command?.type === "speak") speakSelected();
      if (command?.type === "speakOil") speakOil();
    } catch {
      setHeard("");
    } finally {
      setListening(false);
    }
  }

  async function runDeskBrief(kind: "contract" | "spread") {
    if (!apiKey.trim()) {
      return;
    }
    setBriefBusy(true);
    setBriefError(null);
    const context = {
      currency,
      selected,
      selectedName: named(selected),
      quotes: quotes.map((quote) => ({
        symbol: quote.symbol,
        name: named(quote.symbol),
        price: money(quote.price, quote.symbol),
        changePercent: quote.changePercent,
      })),
      spread:
        quoteMap.get("CL=F")?.price != null && quoteMap.get("BZ=F")?.price != null
          ? (quoteMap.get("BZ=F")?.price ?? 0) - (quoteMap.get("CL=F")?.price ?? 0)
          : null,
    };
    const prompt =
      kind === "spread"
        ? lang === "fi"
          ? "Selitä lyhyesti, mitä tämän päivän Brent–WTI-ero tarkoittaa. Ei sijoitusneuvoa."
          : "Briefly explain what today's Brent–WTI spread means. Not investment advice."
        : lang === "fi"
          ? `Briefaa sopimus ${named(selected)} viimeisimmällä noteerauksella. Ei sijoitusneuvoa.`
          : `Brief the contract ${named(selected)} from the latest print. Not investment advice.`;
    try {
      const result = await requestBrief({ prompt, model, context }, apiKey);
      setBrief(result.text);
    } catch (err) {
      setBriefError(err instanceof Error ? err.message : copy.feedIssue);
    } finally {
      setBriefBusy(false);
    }
  }

  const wti = quoteMap.get("CL=F");
  const brent = quoteMap.get("BZ=F");
  const heating = quoteMap.get("HO=F");
  const gasoline = quoteMap.get("RB=F");
  const spread = wti?.price != null && brent?.price != null ? brent.price - wti.price : null;
  const crack = crackSpread321(wti?.price ?? null, gasoline?.price ?? null, heating?.price ?? null);
  const visible = INSTRUMENTS.filter((item) => {
    const hay = `${item.ticker} ${item.name} ${item.nameFi} ${item.symbol}`.toLowerCase();
    return hay.includes(query.trim().toLowerCase()) && (filter === "all" || item.category === filter);
  });
  const tape = quotes.length ? [...quotes, ...quotes] : [];
  const chartPoints = chart?.points?.length ? chart.points : synthesizeHistory(selectedQuote, range);
  const overlayName = selected === "CL=F" ? "Brent" : selected === "BZ=F" ? "WTI" : undefined;
  const statusLabel = error ? copy.feedIssue : offline || stale ? copy.offline : copy.live;
  const canListen = recognitionSupported();

  return (
    <div className="app">
      <header className="masthead">
        <div className="brand">
          <div className="mark" aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 32 32" fill="none" aria-hidden="true">
              <path d="M3 24c5.2-4.2 9-6 13-6s7.8 1.8 13 6v5H3z" fill="#153224"/>
              <path d="M10.5 6.2 5.2 14.8h3.1L4.8 20.6h11.4l-3.5-5.8h3.1z" fill="#3d7a52"/>
              <path d="M10.5 11.4 6.6 17.8h2.4L6.2 22.6h8.6l-2.8-4.8h2.4z" fill="#2a5d3d"/>
              <rect x="21.1" y="11.2" width="3.4" height="11.4" rx="0.7" fill="#e4b25a"/>
              <circle cx="22.8" cy="9.1" r="2.15" fill="#f0c56e"/>
            </svg>
          </div>
          <div>
            <span className="eyebrow">{copy.eyebrow}</span>
            <h1>JarkkoComms</h1>
            <p>{copy.tagline}</p>
          </div>
        </div>
        <div className="desk-tools">
          <div className="fx-switch lang-switch" role="group" aria-label={copy.language}>
            <button className={lang === "fi" ? "active" : ""} onClick={() => changeLang("fi")}>
              FI
            </button>
            <button className={lang === "en" ? "active" : ""} onClick={() => changeLang("en")}>
              EN
            </button>
          </div>
          <div className="fx-switch" role="group" aria-label={copy.currency}>
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
            <span className={error || offline || stale ? "dot stale" : "dot"} />
            <span>{statusLabel}</span>
            <span className="clocks">
              <span>Helsinki <b className="clock">{formatClock(now, "Europe/Helsinki")}</b></span>
              <span>NY <b className="clock">{formatClock(now, "America/New_York")}</b></span>
            </span>
          </div>
          <button type="button" className="ghost extras-link" onClick={() => setSettingsOpen(true)}>
            {copy.extras}
          </button>
        </div>
      </header>

      {speechSupported() && (
        <VoiceBar
          copy={copy}
          canListen={canListen}
          listening={listening}
          speaking={speaking}
          heard={heard}
          onSpeak={speakSelected}
          onSpeakOil={speakOil}
          onStop={() => {
            stopSpeech();
            setSpeaking(false);
          }}
          onListen={() => void onListen()}
        />
      )}

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
          <div className="kicker"><span>{copy.wti}</span><span>CL=F</span></div>
          <div className="value">{money(wti?.price, "CL=F")}</div>
          <div className={tone(wti?.changePercent)}>
            {signed(wti?.change, "CL=F")} · {formatPercent(wti?.changePercent)}
          </div>
          <small>{named("CL=F") || copy.frontMonth}</small>
        </button>
        <button className="stat" onClick={() => setSelected("BZ=F")}>
          <div className="kicker"><span>{copy.brent}</span><span>ICE</span></div>
          <div className="value">{money(brent?.price, "BZ=F")}</div>
          <div className={tone(brent?.changePercent)}>
            {signed(brent?.change, "BZ=F")} · {formatPercent(brent?.changePercent)}
          </div>
          <small>{copy.northSea}</small>
        </button>
        <div className="stat">
          <div className="kicker"><span>{copy.spread}</span><span>{copy.spreadKicker}</span></div>
          <div className="value">{money(spread, "CL=F")}</div>
          <div className={tone(spread)}>{spread == null ? copy.waitingBoth : spread >= 0 ? copy.brentPremium : copy.wtiPremium}</div>
          <small>{copy.interCrude}</small>
        </div>
        <div className="stat">
          <div className="kicker"><span>{copy.crack}</span><span>{copy.refining}</span></div>
          <div className="value">{money(crack, "CL=F")}</div>
          <div className={tone(crack)}>{copy.perBarrel}</div>
          <small>{copy.crackNote}</small>
        </div>
      </section>

      {error && <div className="banner">{error}. {copy.retrying}</div>}

      <div className="workspace">
        <section className="panel">
          <div className="panel-head">
            <h2>{copy.history}</h2>
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
              {named(selected) || selected} <span>{displayUnit(unit, currency)}</span>
            </h3>
            <span>
              {selectedQuote ? `${money(selectedQuote.price)} · ${formatPercent(selectedQuote.changePercent)}` : copy.waitingPrint}
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
            sketchLabel={copy.sketch}
            historyLabel={copy.historyNote}
          />
          <dl className="details">
            <div><dt>{copy.sessionHigh}</dt><dd>{money(selectedQuote?.dayHigh)}</dd></div>
            <div><dt>{copy.sessionLow}</dt><dd>{money(selectedQuote?.dayLow)}</dd></div>
            <div>
              <dt>{copy.week52}</dt>
              <dd>{money(selectedQuote?.week52Low)} – {money(selectedQuote?.week52High)}</dd>
            </div>
            <div><dt>{copy.volume}</dt><dd>{formatVolume(selectedQuote?.volume)}</dd></div>
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
            copy={copy}
          />
          <section className="panel">
            <h2>{copy.watchlist}</h2>
            {watchlist.map((symbol) => {
              const quote = quoteMap.get(symbol);
              const instrument = instrumentBySymbol(symbol);
              return (
                <button key={symbol} className="watch-row" onClick={() => setSelected(symbol)}>
                  <span>
                    <b>{instrument?.ticker ?? symbol}</b>
                    <div className="name">{instrumentName(instrument, lang)}</div>
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
            <h2>{copy.alerts}</h2>
            <p className="name">{fill(copy.notifyWhen, { ticker: selectedInstrument?.ticker ?? selected, currency })}</p>
            <form className="alert-form" onSubmit={addAlert}>
              <select value={alertDirection} onChange={(event) => setAlertDirection(event.target.value as AlertRule["direction"])}>
                <option value="above">{copy.above}</option>
                <option value="below">{copy.below}</option>
              </select>
              <input
                inputMode="decimal"
                placeholder={(() => {
                  const shown = toDisplay(selectedQuote?.price, unit, currency, rate);
                  return shown == null ? copy.target : String(Number(shown.toFixed(4)));
                })()}
                value={alertPrice}
                onChange={(event) => setAlertPrice(event.target.value)}
              />
              <button type="submit">{copy.addAlert}</button>
            </form>
            {alerts.map((rule) => (
              <div className="alert-row" key={rule.id}>
                <span>
                  {instrumentBySymbol(rule.symbol)?.ticker ?? rule.symbol} {rule.direction === "above" ? copy.above : copy.below} {money(rule.price, rule.symbol)}
                  <div className="name">{rule.triggeredAt ? `${copy.hit} ${formatStamp(rule.triggeredAt)}` : copy.armed}</div>
                </span>
                <button className="ghost" onClick={() => setAlerts((current) => current.filter((item) => item.id !== rule.id))}>
                  {copy.remove}
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
              {key === "all" ? copy.allMarkets : copy[key]}
            </button>
          ))}
        </div>
        <input className="search" placeholder={copy.search} value={query} onChange={(event) => setQuery(event.target.value)} />
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
                  <div className="name">{instrumentName(instrument, lang)}</div>
                </button>
                <button
                  className={watched ? "icon-btn active" : "icon-btn"}
                  onClick={() => toggleWatch(instrument.symbol)}
                  aria-label={watched ? copy.removeWatch : copy.addWatch}
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
        {copy.footer}
        {fetchedAt ? ` ${fill(copy.lastPull, { time: formatStamp(fetchedAt) })}` : ""} {copy.fxNote}
        <span className="family">{copy.family}</span>
        <span className="family">{copy.familyFi}</span>
      </p>

      <SettingsPanel
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        copy={copy}
        provider={provider}
        model={model}
        hasKey={Boolean(apiKey)}
        onProvider={setProvider}
        onModel={setModel}
        onSaveKey={(key) => {
          saveDeepSeekKey(key);
          setApiKey(key);
        }}
        onClearKey={() => {
          saveDeepSeekKey("");
          setApiKey("");
        }}
        briefBusy={briefBusy}
        briefText={brief}
        briefError={briefError}
        onBriefContract={() => void runDeskBrief("contract")}
        onBriefSpread={() => void runDeskBrief("spread")}
      />
    </div>
  );
}
