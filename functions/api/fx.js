import { fetchFx } from "../../server/market.mjs";

export async function onRequest() {
  try {
    return Response.json(await fetchFx());
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "FX failed" }, { status: 502 });
  }
}
