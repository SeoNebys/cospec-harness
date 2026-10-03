"use strict";
// HTTP layer built on Node's built-in http module (no external runtime dependencies).

const http = require("http");
const fs = require("fs");
const path = require("path");
const { ValidationError } = require("./service.js");

const PUBLIC_DIR = path.join(__dirname, "..", "public");
const SHARED_DIR = path.join(__dirname, "..", "shared");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".pdf": "application/pdf",
  ".ico": "image/x-icon",
};

function send(res, status, body, headers) {
  res.writeHead(status, Object.assign({ "Content-Type": "application/json; charset=utf-8" }, headers || {}));
  res.end(typeof body === "string" || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}

function sendError(res, err) {
  if (err instanceof ValidationError) {
    const map = { empty: 400, not_a_url: 400, bad_action: 400, duplicate: 409, not_found: 404 };
    const status = map[err.code] || 400;
    return send(res, status, { error: err.code, message: err.message, existing: err.extra.existing || null });
  }
  return send(res, 500, { error: "server_error", message: String(err && err.message || err) });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (c) => { data += c; if (data.length > 5e6) req.destroy(); });
    req.on("end", () => {
      if (!data) return resolve({});
      try { resolve(JSON.parse(data)); } catch (e) { reject(new ValidationError("bad_json", "Invalid request body.")); }
    });
    req.on("error", reject);
  });
}

function serveStatic(res, urlPath) {
  let rel = decodeURIComponent(urlPath.split("?")[0]);
  let base, file;
  if (rel === "/" || rel === "") { base = PUBLIC_DIR; file = "index.html"; }
  else if (rel.startsWith("/shared/")) { base = SHARED_DIR; file = rel.slice("/shared/".length); }
  else { base = PUBLIC_DIR; file = rel.replace(/^\/+/, ""); }

  const full = path.normalize(path.join(base, file));
  if (!full.startsWith(base)) return send(res, 403, { error: "forbidden" });
  fs.readFile(full, (err, buf) => {
    if (err) return send(res, 404, { error: "not_found" });
    const ext = path.extname(full).toLowerCase();
    send(res, 200, buf, { "Content-Type": MIME[ext] || "application/octet-stream" });
  });
}

function createApp(service) {
  return http.createServer(async (req, res) => {
    try {
      const url = req.url || "/";
      const method = req.method || "GET";
      const pathname = url.split("?")[0];

      if (!pathname.startsWith("/api/")) return serveStatic(res, url);

      // /api/bookmarks ...
      const parts = pathname.split("/").filter(Boolean); // ["api","bookmarks", id?, sub?]
      if (parts[1] !== "bookmarks") return send(res, 404, { error: "not_found" });

      // Collection
      if (parts.length === 2) {
        if (method === "GET") return send(res, 200, { items: service.list() });
        if (method === "POST") {
          const body = await readBody(req);
          const item = await service.save(body.url);
          return send(res, 201, { item });
        }
        return send(res, 405, { error: "method_not_allowed" });
      }

      // Bulk
      if (parts.length === 3 && parts[2] === "bulk" && method === "POST") {
        const body = await readBody(req);
        const result = service.bulk(body.ids, body.action, body.tag);
        return send(res, 200, result);
      }

      const id = Number(parts[2]);
      if (!Number.isInteger(id)) return send(res, 400, { error: "bad_id" });

      // Item root
      if (parts.length === 3) {
        if (method === "PATCH") {
          const body = await readBody(req);
          let item = service.get(id);
          if (!item) return send(res, 404, { error: "not_found" });
          if (Object.prototype.hasOwnProperty.call(body, "toRead")) item = service.setToRead(id, body.toRead);
          if (Object.prototype.hasOwnProperty.call(body, "archived")) item = service.setArchived(id, body.archived);
          if (Object.prototype.hasOwnProperty.call(body, "note")) item = service.setNote(id, body.note);
          if (["title", "url", "desc"].some((k) => Object.prototype.hasOwnProperty.call(body, k))) {
            item = await service.edit(id, body);
          }
          return send(res, 200, { item });
        }
        if (method === "DELETE") {
          const ok = service.remove(id);
          return send(res, ok ? 200 : 404, { ok });
        }
        return send(res, 405, { error: "method_not_allowed" });
      }

      // Sub-resources
      const sub = parts[3];
      if (sub === "tags" && method === "POST") {
        const body = await readBody(req);
        const item = service.addTag(id, body.tag);
        return item ? send(res, 200, { item }) : send(res, 404, { error: "not_found" });
      }
      if (sub === "untag" && method === "POST") {
        const body = await readBody(req);
        const item = service.removeTag(id, body.tag);
        return item ? send(res, 200, { item }) : send(res, 404, { error: "not_found" });
      }
      if (sub === "retry" && method === "POST") {
        const item = await service.retry(id);
        return item ? send(res, 200, { item }) : send(res, 404, { error: "not_found" });
      }
      if (sub === "copy" && method === "GET") {
        const copy = service.getCopy(id);
        if (!copy) return send(res, 404, { error: "no_copy", message: "No preserved copy is available for this link." });
        const ctype = copy.kind === "pdf" ? "application/pdf" : "text/html; charset=utf-8";
        return send(res, 200, copy.buffer, { "Content-Type": ctype });
      }

      return send(res, 404, { error: "not_found" });
    } catch (err) {
      return sendError(res, err);
    }
  });
}

module.exports = { createApp };
