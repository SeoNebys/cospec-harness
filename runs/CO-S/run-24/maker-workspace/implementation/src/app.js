// HTTP application (dependency-free, Node built-in http). Serves the single-page
// UI from public/ and a small JSON API backing the approved behaviours.

import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { join, extname, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

import { ensureScheme, isPlausibleUrl, findDuplicate, hostOf } from "../public/logic.js";
import { fetchPageInfo } from "./pageinfo.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const PUBLIC_DIR = join(__dirname, "..", "public");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

function send(res, status, body, headers = {}) {
  const payload = typeof body === "string" || Buffer.isBuffer(body) ? body : JSON.stringify(body);
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", ...headers });
  res.end(payload);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (c) => {
      data += c;
      if (data.length > 1_000_000) reject(new Error("body too large"));
    });
    req.on("end", () => {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch (e) {
        reject(new Error("invalid json"));
      }
    });
    req.on("error", reject);
  });
}

async function serveStatic(res, urlPath) {
  let rel = decodeURIComponent(urlPath.split("?")[0]);
  if (rel === "/" || rel === "") rel = "/index.html";
  const safe = normalize(rel).replace(/^(\.\.[/\\])+/, "");
  const filePath = join(PUBLIC_DIR, safe);
  if (!filePath.startsWith(PUBLIC_DIR)) return send(res, 403, { error: "forbidden" });
  try {
    const buf = await readFile(filePath);
    const type = MIME[extname(filePath).toLowerCase()] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": type });
    res.end(buf);
  } catch (e) {
    // SPA fallback to index.html for unknown non-API GETs
    try {
      const buf = await readFile(join(PUBLIC_DIR, "index.html"));
      res.writeHead(200, { "Content-Type": MIME[".html"] });
      res.end(buf);
    } catch (e2) {
      send(res, 404, { error: "not found" });
    }
  }
}

function newLink(url, info) {
  const ok = !!(info && info.ok && info.title);
  return {
    id: randomUUID(),
    url,
    host: hostOf(url),
    title: ok ? info.title : "",
    description: info && info.description ? info.description : "",
    note: "",
    tags: [],
    inList: false,
    autoFailed: !ok,
    savedAt: Date.now(),
  };
}

// Whitelist of fields a client may patch, with light validation (SCN-002/003/004/006).
function sanitizePatch(patch) {
  const out = {};
  if (typeof patch.title === "string") out.title = patch.title.trim();
  if (typeof patch.description === "string") out.description = patch.description.trim();
  if (typeof patch.note === "string") out.note = patch.note.trim();
  if (typeof patch.inList === "boolean") out.inList = patch.inList;
  if (Array.isArray(patch.tags)) {
    const seen = [];
    for (const t of patch.tags) {
      const s = String(t || "").trim().toLowerCase().replace(/^#+/, "").trim();
      if (s && seen.indexOf(s) === -1) seen.push(s);
    }
    out.tags = seen;
  }
  return out;
}

export function createApp({ store, fetchInfo }) {
  const getInfo = fetchInfo || ((url) => fetchPageInfo(url));

  return async function handler(req, res) {
    try {
      const { method } = req;
      const url = req.url || "/";
      const path = url.split("?")[0];

      if (path === "/api/links" && method === "GET") {
        return send(res, 200, { links: store.all() });
      }

      if (path === "/api/links" && method === "POST") {
        let body;
        try {
          body = await readBody(req);
        } catch (e) {
          return send(res, 400, { error: "invalid", message: "Could not read the request." });
        }
        const raw = String(body.url || "").trim();
        if (!raw) {
          return send(res, 400, { error: "empty", message: "Please paste a link first." });
        }
        if (!isPlausibleUrl(raw)) {
          return send(res, 400, {
            error: "invalid",
            message: "That doesn't look like a web address. Check the link and try again.",
          });
        }
        const normalized = ensureScheme(raw);
        const dup = findDuplicate(store.all(), normalized);
        if (dup) {
          return send(res, 409, { error: "duplicate", link: dup });
        }
        const info = await getInfo(normalized);
        const link = newLink(normalized, info);
        await store.add(link);
        return send(res, 201, { link });
      }

      const idMatch = path.match(/^\/api\/links\/([^/]+)$/);
      if (idMatch) {
        const id = decodeURIComponent(idMatch[1]);
        if (method === "PATCH") {
          let body;
          try {
            body = await readBody(req);
          } catch (e) {
            return send(res, 400, { error: "invalid" });
          }
          const patch = sanitizePatch(body);
          const updated = await store.update(id, patch);
          if (!updated) return send(res, 404, { error: "not found" });
          return send(res, 200, { link: updated });
        }
        if (method === "DELETE") {
          const ok = await store.remove(id);
          if (!ok) return send(res, 404, { error: "not found" });
          return send(res, 204, "");
        }
      }

      if (path.startsWith("/api/")) {
        return send(res, 404, { error: "not found" });
      }

      if (method === "GET") {
        return serveStatic(res, url);
      }

      return send(res, 405, { error: "method not allowed" });
    } catch (e) {
      return send(res, 500, { error: "server error" });
    }
  };
}

export function createHttpServer(opts) {
  return createServer(createApp(opts));
}
