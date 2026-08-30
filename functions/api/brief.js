import { runBrief } from "../../server/brief.mjs";

export async function onRequest({ request, env }) {
  if (request.method !== "POST") {
    return Response.json({ error: "POST required" }, { status: 405 });
  }
  const key = request.headers.get("x-deepseek-key") || "";
  try {
    const body = await request.json();
    const result = await runBrief({
      key,
      model: body?.model,
      messages: body?.messages ?? [
        { role: "system", content: "You are a concise commodities desk assistant. Not investment advice. Use only the supplied quotes." },
        { role: "user", content: `${body?.prompt ?? ""}\n\nContext:\n${JSON.stringify(body?.context ?? {})}` },
      ],
    });
    return Response.json(result);
  } catch (error) {
    const status = error?.status === 401 ? 401 : 502;
    return Response.json({ error: error instanceof Error ? error.message : "Brief failed" }, { status });
  }
}
