import { fetchChart } from "../../server/market.mjs";

export async function onRequest({ request }) {
  const url = new URL(request.url);
  const symbol = url.searchParams.get("symbol");
  const range = url.searchParams.get("range") ?? "1mo";
  if (!symbol) return Response.json({ error: "symbol is required" }, { status: 400 });
  try {
    return Response.json(await fetchChart(symbol, range));
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Chart failed" }, { status: 502 });
  }
}
