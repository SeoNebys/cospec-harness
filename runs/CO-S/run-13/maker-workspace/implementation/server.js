// HTTP server: serves the web app and a small JSON API.
// Listens on 0.0.0.0 so the review container can reach it (port 4000 by default).

import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Store, DuplicateError, NotFoundError } from "./src/store.js";
import { fetchMetadata, InvalidUrlError } from "./src/metadata.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 4000;
const HOST = process.env.HOST || "0.0.0.0";
const PUBLIC_DIR = join(__dirname, "public");
const FIXTURE_DIR = join(__dirname, "fixtures");

const store = new Store();

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".png": "image/png",
};

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(body);
}

async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    return null; // signals malformed JSON
  }
}

async function serveStatic(res, baseDir, urlPath, fallback) {
  let rel = decodeURIComponent(urlPath.split("?")[0]);
  if (rel === "/" || rel === "") rel = "/index.html";
  const full = normalize(join(baseDir, rel));
  if (!full.startsWith(baseDir)) {
    res.writeHead(403).end("Forbidden");
    return;
  }
  try {
    const s = await stat(full);
    if (s.isDirectory()) throw new Error("dir");
    const data = await readFile(full);
    res.writeHead(200, { "content-type": MIME[extname(full)] || "application/octet-stream" });
    res.end(data);
  } catch {
    if (fallback) {
      const data = await readFile(join(baseDir, fallback));
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(data);
    } else {
      res.writeHead(404).end("Not found");
    }
  }
}

async function handleApi(req, res, url) {
  const path = url.pathname;

  // Test-only reset, enabled explicitly via env (never in production).
  if (req.method === "POST" && path === "/api/__test/reset" && process.env.ALLOW_TEST_RESET === "1") {
    store.reset();
    return sendJson(res, 200, { ok: true });
  }

  if (req.method === "GET" && path === "/api/bookmarks") {
    return sendJson(res, 200, { items: store.list() });
  }

  if (req.method === "POST" && path === "/api/fetch-metadata") {
    const body = await readBody(req);
    if (!body) return sendJson(res, 400, { error: "bad_json" });
    try {
      const meta = await fetchMetadata(body.url);
      return sendJson(res, 200, meta); // includes { ok:true|false, ... }
    } catch (err) {
      if (err instanceof InvalidUrlError) return sendJson(res, 400, { error: "invalid_url" });
      return sendJson(res, 500, { error: "server_error" });
    }
  }

  if (req.method === "POST" && path === "/api/bookmarks") {
    const body = await readBody(req);
    if (!body) return sendJson(res, 400, { error: "bad_json" });
    try {
      const bm = store.create(body);
      return sendJson(res, 201, { bookmark: bm });
    } catch (err) {
      if (err instanceof DuplicateError) return sendJson(res, 409, { error: "duplicate", existing: err.existing });
      if (err instanceof InvalidUrlError) return sendJson(res, 400, { error: "invalid_url" });
      return sendJson(res, 500, { error: "server_error" });
    }
  }

  const idMatch = path.match(/^\/api\/bookmarks\/(\d+)$/);
  if (idMatch && req.method === "PATCH") {
    const body = await readBody(req);
    if (!body) return sendJson(res, 400, { error: "bad_json" });
    try {
      const bm = store.update(Number(idMatch[1]), body);
      return sendJson(res, 200, { bookmark: bm });
    } catch (err) {
      if (err instanceof DuplicateError) return sendJson(res, 409, { error: "duplicate_url", existing: err.existing });
      if (err instanceof InvalidUrlError) return sendJson(res, 400, { error: "invalid_url" });
      if (err instanceof NotFoundError) return sendJson(res, 404, { error: "not_found" });
      return sendJson(res, 500, { error: "server_error" });
    }
  }

  return sendJson(res, 404, { error: "not_found" });
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    if (url.pathname.startsWith("/api/")) return await handleApi(req, res, url);
    // Local fixtures let the metadata fetcher be exercised without the public internet.
    if (url.pathname.startsWith("/__fixtures/")) {
      return await serveStatic(res, FIXTURE_DIR, url.pathname.replace("/__fixtures", ""));
    }
    return await serveStatic(res, PUBLIC_DIR, url.pathname, "index.html");
  } catch (err) {
    if (!res.headersSent) res.writeHead(500, { "content-type": "text/plain" });
    res.end("Internal error");
  }
});

if (process.env.NODE_ENV !== "test-import") {
  server.listen(PORT, HOST, () => {
    console.log(`Bookmarks app listening on http://${HOST}:${PORT}`);
  });
}

export { server, store };
