// server/brief.mjs
var DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";
var FLASH = "deepseek-v4-flash";
var PRO = "deepseek-v4-pro";
function pickModel(requested) {
  return requested === PRO ? PRO : FLASH;
}
async function runBrief({ key, model, messages }) {
  if (!key || typeof key !== "string") {
    const error = new Error("DeepSeek key missing");
    error.status = 401;
    throw error;
  }
  const allowed = pickModel(model);
  const response = await fetch(DEEPSEEK_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`
    },
    body: JSON.stringify({
      model: allowed,
      messages,
      stream: false,
      max_tokens: 500,
      thinking: { type: "disabled" }
    })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload?.error?.message || `DeepSeek ${response.status}`;
    const error = new Error(message);
    error.status = response.status === 401 ? 401 : 502;
    throw error;
  }
  return {
    text: payload?.choices?.[0]?.message?.content ?? "",
    model: allowed,
    billedTo: "your DeepSeek account"
  };
}

// server/instruments.mjs
var INSTRUMENTS = [
  { symbol: "CL=F", tvSymbol: "NYMEX:CL1!" },
  { symbol: "BZ=F", tvSymbol: "ICEEUR:BRN1!" },
  { symbol: "HO=F", tvSymbol: "NYMEX:HO1!" },
  { symbol: "RB=F", tvSymbol: "NYMEX:RB1!" },
  { symbol: "NG=F", tvSymbol: "NYMEX:NG1!" },
  { symbol: "GC=F", tvSymbol: "COMEX:GC1!" },
  { symbol: "SI=F", tvSymbol: "COMEX:SI1!" },
  { symbol: "HG=F", tvSymbol: "COMEX:HG1!" },
  { symbol: "PL=F", tvSymbol: "NYMEX:PL1!" },
  { symbol: "PA=F", tvSymbol: "NYMEX:PA1!" },
  { symbol: "ZC=F", tvSymbol: "CBOT:ZC1!" },
  { symbol: "ZS=F", tvSymbol: "CBOT:ZS1!" },
  { symbol: "ZW=F", tvSymbol: "CBOT:ZW1!" },
  { symbol: "KC=F", tvSymbol: "ICEUS:KC1!" },
  { symbol: "SB=F", tvSymbol: "ICEUS:SB1!" },
  { symbol: "CC=F", tvSymbol: "ICEUS:CC1!" }
];

// server/market.mjs
var TV_SCAN = "https://scanner.tradingview.com/futures/scan";
var YAHOO_CHART = "https://query1.finance.yahoo.com/v8/finance/chart";
var FRANKFURTER = "https://api.frankfurter.app/latest?from=USD&to=EUR,GBP,JPY,CHF";
var FAWAZ = "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.min.json";
var RANGE_INTERVAL = {
  "1d": "5m",
  "5d": "15m",
  "1mo": "1h",
  "3mo": "1d",
  "6mo": "1d",
  "1y": "1d",
  "5y": "1wk"
};
var RANGE_MS = {
  "1d": 864e5,
  "5d": 5 * 864e5,
  "1mo": 30 * 864e5,
  "3mo": 90 * 864e5,
  "1y": 365 * 864e5,
  "5y": 5 * 365 * 864e5
};
var cache = /* @__PURE__ */ new Map();
var inflight = /* @__PURE__ */ new Map();
var lastQuotes = null;
function cached(key, factory, ttl = 15e3) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < ttl) return Promise.resolve(hit.data);
  if (inflight.has(key)) return inflight.get(key);
  const pending = factory().then((data) => {
    cache.set(key, { at: Date.now(), data });
    inflight.delete(key);
    return data;
  }).catch((error) => {
    inflight.delete(key);
    throw error;
  });
  inflight.set(key, pending);
  return pending;
}
function yahooHeaders() {
  return {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    Accept: "application/json,text/plain,*/*"
  };
}
async function fetchJson(url, init, retries = 2) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const response = await fetch(url, init);
    if (response.status === 429 && attempt < retries) {
      await new Promise((resolve) => setTimeout(resolve, 700 * (attempt + 1)));
      continue;
    }
    if (!response.ok) {
      lastError = new Error(`Upstream ${response.status}`);
      if (attempt < retries) continue;
      throw lastError;
    }
    return response.json();
  }
  throw lastError ?? new Error("Upstream failed");
}
function synthesizeHistory(quote, range = "1mo") {
  const price = quote?.price;
  if (price == null) return [];
  const now = Date.now();
  const span = RANGE_MS[range] ?? RANGE_MS["1mo"];
  const spark = (quote.sparkline ?? []).filter((value) => value != null);
  if (spark.length >= 3) {
    return spark.map((close, index) => ({
      time: now - span + span * index / Math.max(1, spark.length - 1),
      close,
      high: close,
      low: close,
      volume: 0
    }));
  }
  const prev = quote.previous ?? price;
  const low = quote.dayLow ?? quote.week52Low ?? Math.min(prev, price);
  const high = quote.dayHigh ?? quote.week52High ?? Math.max(prev, price);
  const path = [prev, (prev + low) / 2, low, (low + high) / 2, high, (high + price) / 2, price];
  return path.map((close, index) => ({
    time: now - span + span * index / (path.length - 1),
    close,
    high: close,
    low: close,
    volume: 0
  }));
}
async function loadTradingViewQuotes(wanted) {
  const instruments = INSTRUMENTS.filter((item) => wanted.includes(item.symbol));
  const payload = await fetchJson(
    TV_SCAN,
    {
      method: "POST",
      headers: { ...yahooHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({
        symbols: { tickers: instruments.map((item) => item.tvSymbol) },
        columns: [
          "close",
          "change",
          "change_abs",
          "high",
          "low",
          "volume",
          "description",
          "price_52_week_high",
          "price_52_week_low"
        ]
      })
    },
    1
  );
  const byTv = new Map(instruments.map((item) => [item.tvSymbol, item]));
  const quotes = [];
  for (const row of payload?.data ?? []) {
    const instrument = byTv.get(row.s);
    if (!instrument) continue;
    const [close, changePercent, changeAbs, high, low, volume, description, week52High, week52Low] = row.d;
    quotes.push({
      symbol: instrument.symbol,
      name: description ?? instrument.symbol,
      currency: "USD",
      exchange: instrument.tvSymbol.split(":")[0],
      price: close ?? null,
      previous: close != null && changeAbs != null ? close - changeAbs : null,
      change: changeAbs ?? null,
      changePercent: changePercent ?? null,
      dayHigh: high ?? null,
      dayLow: low ?? null,
      week52High: week52High ?? null,
      week52Low: week52Low ?? null,
      volume: volume ?? null,
      marketTime: Date.now(),
      timezone: "America/New_York",
      sparkline: []
    });
  }
  return quotes;
}
async function fetchQuotes(symbols) {
  const wanted = symbols.length ? symbols : INSTRUMENTS.map((item) => item.symbol);
  return cached(`quotes:${wanted.slice().sort().join(",")}`, async () => {
    try {
      const quotes = await loadTradingViewQuotes(wanted);
      const found = new Set(quotes.map((quote) => quote.symbol));
      const errors = wanted.filter((symbol) => !found.has(symbol)).map((symbol) => ({ symbol, error: "No quote returned" }));
      const payload = { quotes, errors, fetchedAt: Date.now(), source: "tradingview" };
      lastQuotes = payload;
      return payload;
    } catch (error) {
      if (lastQuotes) return { ...lastQuotes, source: "cache", warning: String(error.message ?? error) };
      throw error;
    }
  });
}
async function loadYahooChart(symbol, range) {
  const interval = RANGE_INTERVAL[range] ?? "1d";
  const url = `${YAHOO_CHART}/${encodeURIComponent(symbol)}?interval=${interval}&range=${range}&includePrePost=false`;
  const payload = await fetchJson(url, { headers: yahooHeaders() }, 1);
  const result = payload?.chart?.result?.[0];
  if (!result) throw new Error(payload?.chart?.error?.description || `No chart data for ${symbol}`);
  const meta = result.meta ?? {};
  const timestamps = result.timestamp ?? [];
  const quote = result.indicators?.quote?.[0] ?? {};
  const closes = quote.close ?? [];
  const highs = quote.high ?? [];
  const lows = quote.low ?? [];
  const volumes = quote.volume ?? [];
  const points = [];
  for (let i = 0; i < timestamps.length; i += 1) {
    const close = closes[i];
    if (close == null) continue;
    points.push({
      time: timestamps[i] * 1e3,
      close,
      high: highs[i] ?? close,
      low: lows[i] ?? close,
      volume: volumes[i] ?? 0
    });
  }
  if (!points.length) throw new Error(`Empty Yahoo series for ${symbol}`);
  const price = meta.regularMarketPrice ?? points.at(-1)?.close ?? null;
  const previous = meta.chartPreviousClose ?? meta.previousClose ?? null;
  const change = price != null && previous != null ? price - previous : null;
  return {
    symbol: meta.symbol ?? symbol,
    name: meta.shortName ?? meta.longName ?? symbol,
    currency: meta.currency ?? "USD",
    exchange: meta.fullExchangeName ?? meta.exchangeName ?? "",
    price,
    previous,
    change,
    changePercent: meta.regularMarketChangePercent ?? (change != null && previous ? change / previous * 100 : null),
    dayHigh: meta.regularMarketDayHigh ?? null,
    dayLow: meta.regularMarketDayLow ?? null,
    week52High: meta.fiftyTwoWeekHigh ?? null,
    week52Low: meta.fiftyTwoWeekLow ?? null,
    volume: meta.regularMarketVolume ?? null,
    marketTime: meta.regularMarketTime ? meta.regularMarketTime * 1e3 : Date.now(),
    timezone: meta.exchangeTimezoneName ?? "America/New_York",
    range,
    interval,
    source: "yahoo",
    points
  };
}
function quoteFromCache(symbol) {
  return lastQuotes?.quotes?.find((item) => item.symbol === symbol) ?? null;
}
async function fetchChart(symbol, range = "1mo") {
  return cached(`chart:${symbol}:${range}`, async () => {
    try {
      return await loadYahooChart(symbol, range);
    } catch {
      const quote = quoteFromCache(symbol);
      const points = synthesizeHistory(quote ?? { price: null }, range);
      if (!points.length) throw new Error(`No history for ${symbol}`);
      return {
        symbol,
        name: quote?.name ?? symbol,
        currency: "USD",
        exchange: quote?.exchange ?? "",
        price: quote?.price ?? points.at(-1)?.close ?? null,
        previous: quote?.previous ?? null,
        change: quote?.change ?? null,
        changePercent: quote?.changePercent ?? null,
        dayHigh: quote?.dayHigh ?? null,
        dayLow: quote?.dayLow ?? null,
        week52High: quote?.week52High ?? null,
        week52Low: quote?.week52Low ?? null,
        volume: quote?.volume ?? null,
        marketTime: Date.now(),
        timezone: "America/New_York",
        range,
        interval: "sketch",
        source: "sketch",
        points
      };
    }
  }, 45e3);
}
async function fetchFx() {
  return cached("fx:usd", async () => {
    try {
      const payload = await fetchJson(FRANKFURTER, {}, 1);
      return {
        base: "USD",
        rates: { USD: 1, ...payload.rates ?? {} },
        source: "frankfurter",
        fetchedAt: Date.now()
      };
    } catch {
      const payload = await fetchJson(FAWAZ, {}, 1);
      const usd = payload.usd ?? {};
      return {
        base: "USD",
        rates: {
          USD: 1,
          EUR: usd.eur,
          GBP: usd.gbp,
          JPY: usd.jpy,
          CHF: usd.chf
        },
        source: "fawaz",
        fetchedAt: Date.now()
      };
    }
  }, 60 * 60 * 1e3);
}

// scripts/pages-worker.js
var pages_worker_default = {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      if (url.pathname === "/api/quotes") {
        const symbols = (url.searchParams.get("symbols") ?? "").split(",").map((symbol) => symbol.trim()).filter(Boolean);
        return Response.json(await fetchQuotes(symbols));
      }
      if (url.pathname === "/api/chart") {
        const symbol = url.searchParams.get("symbol");
        const range = url.searchParams.get("range") ?? "1mo";
        if (!symbol) return Response.json({ error: "symbol is required" }, { status: 400 });
        return Response.json(await fetchChart(symbol, range));
      }
      if (url.pathname === "/api/fx") {
        return Response.json(await fetchFx());
      }
      if (url.pathname === "/api/brief") {
        if (request.method !== "POST") return Response.json({ error: "POST required" }, { status: 405 });
        const body = await request.json();
        const key = request.headers.get("x-deepseek-key") || env.DEEPSEEK_API_KEY || "";
        return Response.json(
          await runBrief({
            key,
            model: body?.model,
            messages: [
              { role: "system", content: "You are a concise commodities desk assistant. Not investment advice. Use only the supplied quotes." },
              { role: "user", content: `${body?.prompt ?? ""}

Context:
${JSON.stringify(body?.context ?? {})}` }
            ]
          })
        );
      }
    } catch (error) {
      return Response.json({ error: error instanceof Error ? error.message : "API failed" }, { status: 502 });
    }
    return env.ASSETS.fetch(request);
  }
};
export {
  pages_worker_default as default
};
