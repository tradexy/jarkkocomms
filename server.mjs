import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fetchChart, fetchFx, fetchQuotes } from "./server/market.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(__dirname, "dist");
const PORT = Number(process.env.PORT || 5176);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

function sendJson(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

async function handleApi(req, res) {
  const url = new URL(req.url ?? "/", `http://127.0.0.1:${PORT}`);
  if (url.pathname === "/api/health") {
    sendJson(res, 200, { ok: true });
    return true;
  }
  if (url.pathname === "/api/quotes") {
    const symbols = (url.searchParams.get("symbols") ?? "")
      .split(",")
      .map((s) => s.trim())
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
  return false;
}

function serveStatic(req, res) {
  const url = new URL(req.url ?? "/", `http://127.0.0.1:${PORT}`);
  const filePath = path.normalize(
    path.join(dist, url.pathname === "/" ? "index.html" : url.pathname),
  );
  if (!filePath.startsWith(dist)) {
    res.writeHead(403);
    res.end();
    return;
  }
  const resolved = fs.existsSync(filePath) && fs.statSync(filePath).isFile()
    ? filePath
    : path.join(dist, "index.html");
  const ext = path.extname(resolved);
  res.writeHead(200, { "Content-Type": MIME[ext] ?? "application/octet-stream" });
  fs.createReadStream(resolved).pipe(res);
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.url?.startsWith("/api/")) {
      const handled = await handleApi(req, res);
      if (handled) return;
    }
    serveStatic(req, res);
  } catch (error) {
    sendJson(res, 502, { error: error instanceof Error ? error.message : "Server error" });
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`JarkkoComms → http://127.0.0.1:${PORT}`);
});
