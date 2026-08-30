import { runBrief } from "../server/brief.mjs";
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
      if (url.pathname === "/api/brief") {
        if (request.method !== "POST") return Response.json({ error: "POST required" }, { status: 405 });
        const body = await request.json();
        const key = request.headers.get("x-deepseek-key") || "";
        return Response.json(
          await runBrief({
            key,
            model: body?.model,
            messages: [
              { role: "system", content: "You are a concise commodities desk assistant. Not investment advice. Use only the supplied quotes." },
              { role: "user", content: `${body?.prompt ?? ""}\n\nContext:\n${JSON.stringify(body?.context ?? {})}` },
            ],
          }),
        );
      }
    } catch (error) {
      return Response.json({ error: error instanceof Error ? error.message : "API failed" }, { status: 502 });
    }
    return env.ASSETS.fetch(request);
  },
};
