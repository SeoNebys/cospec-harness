import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join, normalize, extname } from "node:path";
import * as store from "./store.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = join(__dirname, "public");
const PORT = Number(process.env.PORT) || 4000;
const HOST = process.env.HOST || "0.0.0.0";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".json": "application/json; charset=utf-8",
};

function sendJson(res, status, body) {
  const data = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(data),
  });
  res.end(data);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 1_000_000) {
        reject(new Error("Payload too large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new store.ValidationError("Request body must be valid JSON."));
      }
    });
    req.on("error", reject);
  });
}

async function handleApi(req, res, url) {
  const parts = url.pathname.split("/").filter(Boolean); // ["api", "bookmarks", ":id"]
  const resource = parts[1];

  try {
    if (resource === "bookmarks") {
      const id = parts[2];
      if (!id) {
        if (req.method === "GET") {
          const items = await store.list({
            q: url.searchParams.get("q") || "",
            tag: url.searchParams.get("tag") || "",
          });
          return sendJson(res, 200, { bookmarks: items });
        }
        if (req.method === "POST") {
          const body = await readBody(req);
          const created = await store.create(body);
          return sendJson(res, 201, { bookmark: created });
        }
      } else {
        if (req.method === "PUT" || req.method === "PATCH") {
          const body = await readBody(req);
          const updated = await store.update(id, body);
          if (!updated) return sendJson(res, 404, { error: "Bookmark not found." });
          return sendJson(res, 200, { bookmark: updated });
        }
        if (req.method === "DELETE") {
          const ok = await store.remove(id);
          if (!ok) return sendJson(res, 404, { error: "Bookmark not found." });
          return sendJson(res, 200, { ok: true });
        }
      }
    }

    if (resource === "tags" && req.method === "GET") {
      return sendJson(res, 200, { tags: await store.allTags() });
    }

    return sendJson(res, 404, { error: "Not found." });
  } catch (err) {
    if (err instanceof store.ValidationError) {
      return sendJson(res, 400, { error: err.message });
    }
    console.error("API error:", err);
    return sendJson(res, 500, { error: "Internal server error." });
  }
}

async function serveStatic(req, res, url) {
  let pathname = url.pathname === "/" ? "/index.html" : url.pathname;
  // Prevent path traversal.
  const safePath = normalize(join(PUBLIC_DIR, pathname));
  if (!safePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    return res.end("Forbidden");
  }
  try {
    const data = await readFile(safePath);
    const type = MIME[extname(safePath)] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": type });
    res.end(data);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not found");
  }
}

const server = createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  if (url.pathname.startsWith("/api/")) {
    handleApi(req, res, url);
  } else {
    serveStatic(req, res, url);
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Bookmark manager listening on http://${HOST}:${PORT}`);
});
