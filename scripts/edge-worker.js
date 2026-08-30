const MAP = [
  ["CL=F", "NYMEX:CL1!"],
  ["BZ=F", "ICEEUR:BRN1!"],
  ["HO=F", "NYMEX:HO1!"],
  ["RB=F", "NYMEX:RB1!"],
  ["NG=F", "NYMEX:NG1!"],
  ["GC=F", "COMEX:GC1!"],
  ["SI=F", "COMEX:SI1!"],
  ["HG=F", "COMEX:HG1!"],
  ["PL=F", "NYMEX:PL1!"],
  ["PA=F", "NYMEX:PA1!"],
  ["ZC=F", "CBOT:ZC1!"],
  ["ZS=F", "CBOT:ZS1!"],
  ["ZW=F", "CBOT:ZW1!"],
  ["KC=F", "ICEUS:KC1!"],
  ["SB=F", "ICEUS:SB1!"],
  ["CC=F", "ICEUS:CC1!"],
];

const HTML = `<!doctype html><html lang="en"><head><meta charset="UTF-8"/><link rel="icon" type="image/svg+xml" href="/favicon.svg"/><meta name="viewport" content="width=device-width, initial-scale=1.0"/><meta name="theme-color" content="#070604"/><title>JarkkoComms — Oil & Commodities Desk</title><link rel="preconnect" href="https://fonts.googleapis.com"/><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/><link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=IBM+Plex+Mono:wght@400;500;600&family=Outfit:wght@400;500;600&display=swap" rel="stylesheet"/><script type="module" crossorigin src="https://cdn.jsdelivr.net/gh/tradexy/jarkkocomms@b38dfbd/publish-assets/assets/index-DcKCWj3B.js"></script><link rel="stylesheet" crossorigin href="https://cdn.jsdelivr.net/gh/tradexy/jarkkocomms@b38dfbd/publish-assets/assets/index-DwSHuLaQ.css"></head><body><div id="root"></div></body></html>`;

const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="#070604"/><path d="M3 24c5.2-4.2 9-6 13-6s7.8 1.8 13 6v5H3z" fill="#153224"/><path d="M10.5 6.2 5.2 14.8h3.1L4.8 20.6h11.4l-3.5-5.8h3.1z" fill="#3d7a52"/><path d="M10.5 11.4 6.6 17.8h2.4L6.2 22.6h8.6l-2.8-4.8h2.4z" fill="#2a5d3d"/><rect x="21.1" y="11.2" width="3.4" height="11.4" rx="0.7" fill="#e4b25a"/><circle cx="22.8" cy="9.1" r="2.15" fill="#f0c56e"/></svg>`;

const UA = { "User-Agent": "Mozilla/5.0", Accept: "application/json" };

export default {
  async fetch(request) {
    const url = new URL(request.url);
    try {
      if (url.pathname === "/api/quotes") {
        const wanted = (url.searchParams.get("symbols") || "").split(",").map((s) => s.trim()).filter(Boolean);
        const tickers = MAP.filter(([s]) => !wanted.length || wanted.includes(s));
        const payload = await fetch("https://scanner.tradingview.com/futures/scan", {
          method: "POST",
          headers: { ...UA, "Content-Type": "application/json" },
          body: JSON.stringify({
            symbols: { tickers: tickers.map(([, tv]) => tv) },
            columns: ["close", "change", "change_abs", "high", "low", "volume", "description", "price_52_week_high", "price_52_week_low"],
          }),
        }).then((r) => r.json());
        const byTv = new Map(tickers.map(([s, tv]) => [tv, s]));
        const quotes = [];
        for (const row of payload?.data ?? []) {
          const symbol = byTv.get(row.s);
          if (!symbol) continue;
          const [close, changePercent, changeAbs, high, low, volume, description, week52High, week52Low] = row.d;
          quotes.push({
            symbol, name: description ?? symbol, currency: "USD", exchange: row.s.split(":")[0],
            price: close ?? null, previous: close != null && changeAbs != null ? close - changeAbs : null,
            change: changeAbs ?? null, changePercent: changePercent ?? null,
            dayHigh: high ?? null, dayLow: low ?? null, week52High: week52High ?? null, week52Low: week52Low ?? null,
            volume: volume ?? null, marketTime: Date.now(), timezone: "America/New_York", sparkline: [],
          });
        }
        return Response.json({ quotes, errors: [], fetchedAt: Date.now(), source: "tradingview" });
      }
      if (url.pathname === "/api/fx") {
        const payload = await fetch("https://api.frankfurter.app/latest?from=USD&to=EUR,GBP,JPY,CHF").then((r) => r.json());
        return Response.json({ base: "USD", rates: { USD: 1, ...(payload.rates ?? {}) }, source: "frankfurter", fetchedAt: Date.now() });
      }
      if (url.pathname === "/api/chart") {
        const symbol = url.searchParams.get("symbol");
        const range = url.searchParams.get("range") ?? "1mo";
        if (!symbol) return Response.json({ error: "symbol is required" }, { status: 400 });
        const interval = { "1d": "5m", "5d": "15m", "1mo": "1h", "3mo": "1d", "1y": "1d", "5y": "1wk" }[range] ?? "1d";
        const payload = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${interval}&range=${range}&includePrePost=false`, { headers: UA }).then((r) => r.json());
        const result = payload?.chart?.result?.[0];
        if (!result) return Response.json({ error: `No history for ${symbol}` }, { status: 502 });
        const meta = result.meta ?? {};
        const quote = result.indicators?.quote?.[0] ?? {};
        const points = [];
        for (let i = 0; i < (result.timestamp ?? []).length; i += 1) {
          const close = quote.close?.[i];
          if (close == null) continue;
          points.push({ time: result.timestamp[i] * 1000, close, high: quote.high?.[i] ?? close, low: quote.low?.[i] ?? close, volume: quote.volume?.[i] ?? 0 });
        }
        return Response.json({
          symbol: meta.symbol ?? symbol, name: meta.shortName ?? symbol, currency: meta.currency ?? "USD",
          price: meta.regularMarketPrice ?? points.at(-1)?.close ?? null,
          previous: meta.chartPreviousClose ?? null, change: null, changePercent: meta.regularMarketChangePercent ?? null,
          dayHigh: meta.regularMarketDayHigh ?? null, dayLow: meta.regularMarketDayLow ?? null,
          week52High: meta.fiftyTwoWeekHigh ?? null, week52Low: meta.fiftyTwoWeekLow ?? null,
          volume: meta.regularMarketVolume ?? null, marketTime: Date.now(), timezone: "America/New_York",
          range, interval, source: "yahoo", points,
        });
      }
      if (url.pathname === "/api/brief") {
        if (request.method !== "POST") return Response.json({ error: "POST required" }, { status: 405 });
        const body = await request.json();
        const key = request.headers.get("x-deepseek-key") || "";
        if (!key) return Response.json({ error: "DeepSeek key missing" }, { status: 401 });
        const model = body?.model === "deepseek-v4-pro" ? "deepseek-v4-pro" : "deepseek-v4-flash";
        const upstream = await fetch("https://api.deepseek.com/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
          body: JSON.stringify({
            model,
            stream: false,
            max_tokens: 500,
            thinking: { type: "disabled" },
            messages: [
              { role: "system", content: "You are a concise commodities desk assistant. Not investment advice. Use only the supplied quotes." },
              { role: "user", content: `${body?.prompt ?? ""}\n\nContext:\n${JSON.stringify(body?.context ?? {})}` },
            ],
          }),
        });
        const payload = await upstream.json().catch(() => ({}));
        if (!upstream.ok) return Response.json({ error: payload?.error?.message || `DeepSeek ${upstream.status}` }, { status: upstream.status === 401 ? 401 : 502 });
        return Response.json({ text: payload?.choices?.[0]?.message?.content ?? "", model, billedTo: "your DeepSeek account" });
      }
    } catch (error) {
      return Response.json({ error: error instanceof Error ? error.message : "API failed" }, { status: 502 });
    }
    if (url.pathname === "/favicon.svg") {
      return new Response(SVG, { headers: { "content-type": "image/svg+xml" } });
    }
    return new Response(HTML, { headers: { "content-type": "text/html; charset=utf-8" } });
  },
};
