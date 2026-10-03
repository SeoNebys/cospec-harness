// HTTP server for the bookmarks app.
// Responsibilities:
//   1. Serve the static single-page app from public/.
//   2. Provide GET /api/metadata?url=... which fetches a page server-side and
//      returns its title/description/image/favicon (SCN-001). Doing this on the
//      server avoids browser cross-origin restrictions.
// Bookmarks themselves are NOT stored on the server — they live in the browser
// (localStorage), per the private, browser-local persistence decision (SCN-012).

import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseMetadata } from "./src/metadata.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, "public");
const PORT = Number(process.env.PORT) || 4000;
const HOST = process.env.HOST || "0.0.0.0";
const FETCH_TIMEOUT_MS = 8000;

const CONTENT_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    if (url.pathname === "/api/metadata") {
      return await handleMetadata(url, res);
    }
    return await serveStatic(url.pathname, res);
  } catch (err) {
    sendJson(res, 500, { error: true, message: "Internal error" });
  }
});

async function handleMetadata(url, res) {
  const target = url.searchParams.get("url") || "";
  const host = safeHost(target);
  if (!isFetchableUrl(target)) {
    return sendJson(res, 200, { error: true, host });
  }
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const response = await fetch(target, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        // Identify politely; some sites vary metadata by UA.
        "User-Agent": "BookmarksApp/1.0 (+personal bookmark manager)",
        Accept: "text/html,application/xhtml+xml",
      },
    });
    clearTimeout(timer);
    if (!response.ok) {
      return sendJson(res, 200, { error: true, host });
    }
    const finalUrl = response.url || target;
    const html = await readCapped(response, 512 * 1024); // cap at 512KB
    const meta = parseMetadata(html, finalUrl);
    return sendJson(res, 200, { error: false, ...meta });
  } catch {
    return sendJson(res, 200, { error: true, host });
  }
}

// Read a response body but stop after `maxBytes` — the <head> metadata we need
// is near the top, and this bounds memory/time for huge pages.
async function readCapped(response, maxBytes) {
  const reader = response.body?.getReader?.();
  if (!reader) return await response.text();
  const decoder = new TextDecoder("utf-8");
  let received = 0;
  let out = "";
  while (received < maxBytes) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.length;
    out += decoder.decode(value, { stream: true });
    if (/<\/head>/i.test(out)) break; // have the whole head — enough
  }
  try { await reader.cancel(); } catch { /* ignore */ }
  return out;
}

async function serveStatic(pathname, res) {
  let rel = pathname === "/" ? "/index.html" : pathname;
  // Prevent path traversal.
  const resolved = path.normalize(path.join(PUBLIC_DIR, rel));
  if (!resolved.startsWith(PUBLIC_DIR)) {
    return sendText(res, 403, "Forbidden");
  }
  try {
    const data = await fs.readFile(resolved);
    const ext = path.extname(resolved).toLowerCase();
    res.writeHead(200, { "Content-Type": CONTENT_TYPES[ext] || "application/octet-stream" });
    res.end(data);
  } catch {
    // SPA fallback: unknown non-file routes return the app shell.
    if (!path.extname(resolved)) {
      try {
        const shell = await fs.readFile(path.join(PUBLIC_DIR, "index.html"));
        res.writeHead(200, { "Content-Type": CONTENT_TYPES[".html"] });
        return res.end(shell);
      } catch { /* fall through */ }
    }
    sendText(res, 404, "Not found");
  }
}

// SSRF guard: only fetch public http(s) URLs, block loopback/private hosts.
export function isFetchableUrl(raw) {
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    return false;
  }
  if (!/^https?:$/.test(parsed.protocol)) return false;
  const h = parsed.hostname.toLowerCase();
  if (h === "localhost" || h.endsWith(".local")) return false;
  if (h === "0.0.0.0" || h === "::1" || h === "[::1]") return false;
  if (/^127\./.test(h)) return false;
  if (/^10\./.test(h)) return false;
  if (/^192\.168\./.test(h)) return false;
  if (/^169\.254\./.test(h)) return false;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(h)) return false;
  return true;
}

function safeHost(raw) {
  try {
    return new URL(raw).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function sendJson(res, status, obj) {
  res.writeHead(status, { "Content-Type": CONTENT_TYPES[".json"] });
  res.end(JSON.stringify(obj));
}
function sendText(res, status, text) {
  res.writeHead(status, { "Content-Type": "text/plain; charset=utf-8" });
  res.end(text);
}

// Only listen when run directly (not when imported by tests).
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  server.listen(PORT, HOST, () => {
    console.log(`Bookmarks app listening on http://${HOST}:${PORT}`);
  });
}

export { server };
