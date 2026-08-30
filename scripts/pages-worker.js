import { fetchChart, fetchFx, fetchQuotes } from "../server/market.mjs";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      if (url.pathname === "/api/quotes") {
        const symbols = (url.searchParams.get("symbols") ?? "")
          .split(",")
          .map((symbol) => symbol.trim())
          .filter(Boolean);
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
    } catch (error) {
      return Response.json({ error: error instanceof Error ? error.message : "API failed" }, { status: 502 });
    }
    return env.ASSETS.fetch(request);
  },
};
