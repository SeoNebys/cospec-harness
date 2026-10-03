/*
 * server.js — HTTP server: serves the single-page app and a small JSON API,
 * and fetches real page metadata. Single-user, server-synced (NF-003/NF-004).
 */
"use strict";
const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { Store } = require("./lib/store.js");
const { fetchMetadata } = require("./lib/metadata.js");
const { normalizeUrl } = require("./public/js/core.js");

const PORT = parseInt(process.env.PORT || "4000", 10);
const HOST = process.env.HOST || "0.0.0.0";
const DATA_FILE = process.env.LINKLIB_DATA || path.join(__dirname, "data", "store.json");
const PUBLIC_DIR = path.join(__dirname, "public");

const store = new Store(DATA_FILE);

const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml", ".ico": "image/x-icon" };

function send(res, status, body, headers) {
  res.writeHead(status, Object.assign({ "Content-Type": "application/json; charset=utf-8" }, headers || {}));
  res.end(typeof body === "string" || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = ""; let size = 0;
    req.on("data", c => { size += c.length; if (size > 20 * 1024 * 1024) { reject(new Error("too large")); req.destroy(); } data += c; });
    req.on("end", () => { if (!data) return resolve({}); try { resolve(JSON.parse(data)); } catch (e) { reject(new Error("bad json")); } });
    req.on("error", reject);
  });
}
function newId() { return crypto.randomUUID(); }
function nowTs() { return Math.floor(Date.now() / 1000); }

function buildLink(body, { isImport } = {}) {
  const n = normalizeUrl(body.url);
  if (!n.ok) return { error: "invalid_url" };
  const ts = isImport && Number.isFinite(body.addedTs) && body.addedTs > 0 ? Math.floor(body.addedTs) : nowTs();
  const tags = Array.isArray(body.tags) ? [...new Set(body.tags.map(t => String(t).trim().toLowerCase()).filter(Boolean))] : [];
  return {
    link: {
      id: newId(), url: n.url, domain: n.domain,
      site: (body.site && String(body.site)) || n.domain,
      title: (body.title && String(body.title).trim()) || n.domain,
      description: body.description ? String(body.description).trim() : "",
      note: body.note ? String(body.note) : "",
      image: body.image || null, favicon: body.favicon || null,
      addedTs: ts, toRead: !!body.toRead, tags, archived: !!body.archived,
    },
  };
}

async function handleApi(req, res, url) {
  const parts = url.pathname.split("/").filter(Boolean); // e.g. ["api","links","<id>"]
  const seg = parts[1];

  if (req.method === "GET" && url.pathname === "/api/state") return send(res, 200, store.getState());

  if (req.method === "POST" && url.pathname === "/api/metadata") {
    const body = await readBody(req);
    const meta = await fetchMetadata(body.url);
    return send(res, 200, meta);
  }

  if (seg === "links") {
    const id = parts[2];
    if (req.method === "POST" && url.pathname === "/api/links") {
      const body = await readBody(req);
      const built = buildLink(body, { isImport: false });
      if (built.error) return send(res, 400, { error: built.error });
      const existing = store.state.links.find(l => l.url === built.link.url);
      if (existing) return send(res, 409, { error: "duplicate", existingId: existing.id });
      return send(res, 201, store.addLink(built.link));
    }
    if (req.method === "POST" && url.pathname === "/api/links/bulk-create") {
      const body = await readBody(req);
      const rows = Array.isArray(body.links) ? body.links : [];
      let added = 0, skipped = 0;
      for (const row of rows) {
        const built = buildLink(row, { isImport: true });
        if (built.error) { skipped++; continue; }
        if (store.hasUrl(built.link.url)) { skipped++; continue; }
        store.addLink(built.link); added++;
      }
      return send(res, 200, { added, skipped, state: store.getState() });
    }
    if (req.method === "POST" && url.pathname === "/api/links/bulk") {
      const body = await readBody(req);
      const ids = Array.isArray(body.ids) ? body.ids : [];
      const op = body.op;
      if (op === "delete") { store.deleteLinks(ids); return send(res, 200, store.getState()); }
      const mutators = {
        addTag: l => { l.tags = l.tags || []; const v = String(body.value || "").trim().toLowerCase(); if (v && !l.tags.includes(v)) l.tags.push(v); },
        removeTag: l => { if (l.tags) l.tags = l.tags.filter(t => t !== String(body.value || "").toLowerCase()); },
        setToRead: l => { l.toRead = !!body.value; },
        setArchived: l => { l.archived = !!body.value; },
      };
      const fn = mutators[op];
      if (!fn) return send(res, 400, { error: "bad_op" });
      store.bulkUpdate(ids, fn);
      return send(res, 200, store.getState());
    }
    if (req.method === "PATCH" && id) {
      const body = await readBody(req);
      const l = store.findLink(id); if (!l) return send(res, 404, { error: "not_found" });
      const patch = {};
      if (body.url !== undefined) {
        const n = normalizeUrl(body.url);
        if (!n.ok) return send(res, 400, { error: "invalid_url" });
        if (store.hasUrl(n.url, id)) return send(res, 409, { error: "duplicate" });
        patch.url = n.url; patch.domain = n.domain;
        if (body.site !== undefined) patch.site = String(body.site) || n.domain;
        if (body.image !== undefined) patch.image = body.image || null;
        if (body.favicon !== undefined) patch.favicon = body.favicon || null;
      }
      if (body.title !== undefined) patch.title = String(body.title).trim() || (patch.domain || l.domain);
      if (body.description !== undefined) patch.description = String(body.description).trim();
      if (body.note !== undefined) patch.note = String(body.note);
      if (body.toRead !== undefined) patch.toRead = !!body.toRead;
      if (body.archived !== undefined) patch.archived = !!body.archived;
      if (body.tags !== undefined) patch.tags = [...new Set((body.tags || []).map(t => String(t).trim().toLowerCase()).filter(Boolean))];
      return send(res, 200, store.updateLink(id, patch));
    }
    if (req.method === "DELETE" && id) {
      const ok = store.deleteLink(id);
      return send(res, ok ? 200 : 404, { ok });
    }
  }

  if (seg === "preferences" && req.method === "PUT") {
    const body = await readBody(req);
    const patch = {};
    if (body.defaultSort !== undefined) patch.defaultSort = String(body.defaultSort);
    if (body.perPage !== undefined) patch.perPage = body.perPage === "all" ? "all" : parseInt(body.perPage, 10) || "all";
    if (body.textSize !== undefined) patch.textSize = String(body.textSize);
    return send(res, 200, store.setPreferences(patch));
  }

  if (seg === "saved-views") {
    const id = parts[2];
    if (req.method === "POST" && url.pathname === "/api/saved-views") {
      const body = await readBody(req);
      const name = String(body.name || "").trim();
      if (!name) return send(res, 400, { error: "name_required" });
      const v = { id: newId(), name, search: String(body.search || ""), include: (body.include || []).map(String), exclude: (body.exclude || []).map(String) };
      return send(res, 201, store.addSavedView(v));
    }
    if (req.method === "DELETE" && id) { store.deleteSavedView(id); return send(res, 200, { ok: true }); }
  }

  return send(res, 404, { error: "not_found" });
}

function serveStatic(req, res, url) {
  let rel = decodeURIComponent(url.pathname);
  if (rel === "/") rel = "/index.html";
  const full = path.normalize(path.join(PUBLIC_DIR, rel));
  if (!full.startsWith(PUBLIC_DIR)) return send(res, 403, { error: "forbidden" });
  fs.readFile(full, (err, data) => {
    if (err) return send(res, 404, "Not found", { "Content-Type": "text/plain" });
    send(res, 200, data, { "Content-Type": MIME[path.extname(full)] || "application/octet-stream" });
  });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    if (url.pathname.startsWith("/api/")) return await handleApi(req, res, url);
    if (req.method !== "GET") return send(res, 405, { error: "method_not_allowed" });
    return serveStatic(req, res, url);
  } catch (e) {
    return send(res, e.message === "bad json" ? 400 : 500, { error: e.message || "server_error" });
  }
});

if (require.main === module) {
  server.listen(PORT, HOST, () => console.log(`Link Library on http://${HOST}:${PORT}`));
}
module.exports = { server, store };
