import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import type { IncomingMessage, ServerResponse } from "node:http";
import { runBrief } from "./server/brief.mjs";
import { fetchChart, fetchFx, fetchQuotes } from "./server/market.mjs";

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

async function handleApi(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const url = new URL(req.url ?? "/", "http://localhost");
  if (url.pathname === "/api/quotes") {
    const symbols = (url.searchParams.get("symbols") ?? "")
      .split(",")
      .map((symbol: string) => symbol.trim())
      .filter(Boolean);
    sendJson(res, 200, await fetchQuotes(symbols));
    return true;
  }
  if (url.pathname === "/api/chart") {
    const symbol = url.searchParams.get("symbol");
    const range = url.searchParams.get("range") ?? "1mo";
    if (!symbol) {
      sendJson(res, 400, { error: "symbol is required" });
      return true;
    }
    sendJson(res, 200, await fetchChart(symbol, range));
    return true;
  }
  if (url.pathname === "/api/fx") {
    sendJson(res, 200, await fetchFx());
    return true;
  }
  if (url.pathname === "/api/health") {
    sendJson(res, 200, { ok: true });
    return true;
  }
  if (url.pathname === "/api/brief") {
    const chunks: Buffer[] = [];
    await new Promise<void>((resolve, reject) => {
      req.on("data", (chunk) => chunks.push(chunk as Buffer));
      req.on("end", () => resolve());
      req.on("error", reject);
    });
    const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {};
    const headerKey = String(req.headers["x-deepseek-key"] ?? "");
    const result = await runBrief({
      key: headerKey,
      model: body?.model,
      messages: [
        { role: "system", content: "You are a concise commodities desk assistant. Not investment advice. Use only the supplied quotes." },
        { role: "user", content: `${body?.prompt ?? ""}\n\nContext:\n${JSON.stringify(body?.context ?? {})}` },
      ],
    });
    sendJson(res, 200, result);
    return true;
  }
  return false;
}

function marketApi(): Plugin {
  const middleware = (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    void handleApi(req, res)
      .then((handled) => {
        if (!handled) next();
      })
      .catch((error: unknown) => {
        sendJson(res, 502, { error: error instanceof Error ? error.message : "Market fetch failed" });
      });
  };

  return {
    name: "commodities-market-api",
    configureServer(server) {
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware);
    },
  };
}

export default defineConfig({
  plugins: [react(), marketApi()],
  server: {
    port: 5176,
    host: "127.0.0.1",
  },
});
