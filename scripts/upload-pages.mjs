import { createHash } from "node:crypto";
import { readdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
const root = new URL("..", import.meta.url).pathname;
const dist = join(root, "dist");
const jwt = process.env.PAGES_JWT;
if (!jwt) throw new Error("PAGES_JWT missing");

function walk(dir, files = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, files);
    else files.push(path);
  }
  return files;
}

const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".json": "application/json",
};

const files = walk(dist).map((path) => {
  const buf = readFileSync(path);
  const hash = createHash("sha256").update(buf).digest("hex");
  const rel = `/${relative(dist, path).split("\\").join("/")}`;
  const ext = rel.slice(rel.lastIndexOf("."));
  return { path: rel === "/_worker.js" ? "/_worker.js" : rel, hash, buf, type: mime[ext] ?? "application/octet-stream" };
});

const hashes = files.map((file) => file.hash);
const missingRes = await fetch("https://api.cloudflare.com/client/v4/pages/assets/check-missing", {
  method: "POST",
  headers: { Authorization: `Bearer ${jwt}`, "Content-Type": "application/json" },
  body: JSON.stringify({ hashes }),
});
const missingJson = await missingRes.json();
if (!missingJson.success) {
  console.error(JSON.stringify(missingJson.errors));
  process.exit(1);
}
const missing = new Set(missingJson.result ?? []);
const toUpload = files.filter((file) => missing.has(file.hash));
if (toUpload.length) {
  const uploadRes = await fetch("https://api.cloudflare.com/client/v4/pages/assets/upload", {
    method: "POST",
    headers: { Authorization: `Bearer ${jwt}`, "Content-Type": "application/json" },
    body: JSON.stringify(
      toUpload.map((file) => ({
        key: file.hash,
        value: file.buf.toString("base64"),
        base64: true,
        metadata: { contentType: file.type },
      })),
    ),
  });
  const uploadJson = await uploadRes.json();
  if (!uploadJson.success) {
    console.error(JSON.stringify(uploadJson.errors));
    process.exit(1);
  }
}

const manifest = Object.fromEntries(files.filter((file) => file.path !== "/_worker.js").map((file) => [file.path, { hash: file.hash, size: file.buf.length }]));
writeFileSync(join(root, "dist/manifest.json"), JSON.stringify(manifest));
writeFileSync(join(root, "dist/worker-hash.txt"), files.find((file) => file.path === "/_worker.js")?.hash ?? "");
console.log(JSON.stringify({ files: files.length, uploaded: toUpload.length, paths: files.map((file) => file.path) }));
