import { fetchQuotes } from "../../server/market.mjs";

export async function onRequest({ request }) {
  const url = new URL(request.url);
  const symbols = (url.searchParams.get("symbols") ?? "")
    .split(",")
    .map((symbol) => symbol.trim())
    .filter(Boolean);
  try {
    return Response.json(await fetchQuotes(symbols));
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Quotes failed" }, { status: 502 });
  }
}
