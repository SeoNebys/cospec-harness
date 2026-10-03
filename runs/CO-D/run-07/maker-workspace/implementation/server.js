// My Bookmarks — production server (cycle 1).
// Node built-in HTTP server: serves the frontend and a JSON API, persists data
// per account (session cookie), fetches page details, and stores preserved copies.

import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { createReadStream, existsSync } from "node:fs";
import { extname, join, normalize as pathNormalize } from "node:path";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

import { getAccount, nextId, save, resetAccount } from "./src/store.js";
import { normalizeUrl, isPlausibleLink, ensureScheme, isPdf } from "./src/normalize.js";
import { fetchMetadata } from "./src/metadata.js";
import { capture, snapshotPath, toInternetArchive } from "./src/preserve.js";
import { parseNetscape, buildNetscape } from "./src/bookmarks.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC = join(__dirname, "public");
const PORT = Number(process.env.PORT || 4000);
const TEST_MODE = process.env.BM_TEST === "1";

const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json", ".svg": "image/svg+xml", ".ico": "image/x-icon", ".pdf": "application/pdf", ".png": "image/png" };

function send(res, status, obj, headers = {}) {
  const body = JSON.stringify(obj);
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", ...headers });
  res.end(body);
}
function readBody(req) {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (c) => { data += c; if (data.length > 20e6) req.destroy(); });
    req.on("end", () => { try { resolve(data ? JSON.parse(data) : {}); } catch { resolve({}); } });
    req.on("error", () => resolve({}));
  });
}
function parseCookies(req) {
  const out = {};
  (req.headers.cookie || "").split(";").forEach((p) => {
    const i = p.indexOf("="); if (i > 0) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
  });
  return out;
}
function sessionUser(req, res) {
  const cookies = parseCookies(req);
  let sid = cookies.bmsid;
  if (!sid || !/^[a-f0-9]{32}$/.test(sid)) {
    sid = randomBytes(16).toString("hex");
    res.setHeader("Set-Cookie", `bmsid=${sid}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000`);
  }
  return "u_" + sid;
}

function publicBookmark(b) {
  return {
    id: b.id, url: b.url, title: b.title, description: b.description || "", site: b.site || "",
    iconUrl: b.iconUrl || "", imageUrl: b.imageUrl || "", tags: b.tags || [], note: b.note || "",
    status: b.status || "toread", archived: !!b.archived, autofilled: b.autofilled !== false,
    ts: b.ts, savedLabel: b.savedLabel || "", isPdf: isPdf(b.url),
    copy: b.copy || null, ia: b.ia || null,
  };
}
function savedLabel(ts) {
  return "Saved · " + new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
function findByNorm(acc, norm, exceptId) {
  return acc.bookmarks.find((b) => b.norm === norm && b.id !== exceptId);
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://x");
    const path = url.pathname;
    const userId = sessionUser(req, res);

    if (path.startsWith("/api/")) return await handleApi(req, res, path, url, userId);
    if (path === "/lib/query.js" || path === "/lib/normalize.js") return serveLib(res, path);
    if (path.startsWith("/copy/")) return handleCopy(res, path, userId);
    if (TEST_MODE && path.startsWith("/testpage")) return handleTestPage(res, path);

    return serveStatic(res, path);
  } catch (err) {
    send(res, 500, { error: "server", detail: String(err && err.message || err) });
  }
});

async function handleApi(req, res, path, url, userId) {
  const acc = getAccount(userId);
  const method = req.method;

  if (path === "/api/state" && method === "GET") {
    return send(res, 200, { bookmarks: acc.bookmarks.map(publicBookmark), views: acc.views, prefs: acc.prefs });
  }

  if (path === "/api/prefs" && method === "PUT") {
    const body = await readBody(req);
    for (const k of ["sort", "autoCopy", "pageSize", "textSize"]) if (k in body) acc.prefs[k] = body[k];
    save();
    return send(res, 200, { prefs: acc.prefs });
  }

  if (path === "/api/preview" && method === "POST") {
    const body = await readBody(req);
    const raw = String(body.url || "").trim();
    if (!isPlausibleLink(raw)) return send(res, 400, { error: "not-a-link" });
    const norm = normalizeUrl(raw);
    const dup = findByNorm(acc, norm);
    const details = await fetchMetadata(raw);
    return send(res, 200, { details, duplicateId: dup ? dup.id : null, isPdf: isPdf(raw), url: ensureScheme(raw) });
  }

  if (path === "/api/bookmarks" && method === "POST") {
    const body = await readBody(req);
    const raw = String(body.url || "").trim();
    if (!isPlausibleLink(raw)) return send(res, 400, { error: "not-a-link" });
    const norm = normalizeUrl(raw);
    const dup = findByNorm(acc, norm);
    if (dup) return send(res, 200, { duplicateId: dup.id });
    const ts = Date.now();
    const b = {
      id: nextId(userId), url: ensureScheme(raw), norm,
      title: body.title || raw, description: body.description || "", site: body.site || "",
      iconUrl: body.iconUrl || "", imageUrl: body.imageUrl || "",
      tags: cleanTags(body.tags), note: (body.note || "").trim(),
      status: "toread", archived: false, autofilled: body.autofilled !== false,
      ts, savedLabel: savedLabel(ts), copy: null, ia: null,
    };
    acc.bookmarks.push(b);
    save();
    if (acc.prefs.autoCopy) captureInBackground(userId, b.id, b.url);
    return send(res, 201, { bookmark: publicBookmark(b) });
  }

  const mBm = path.match(/^\/api\/bookmarks\/([^/]+)$/);
  if (mBm) {
    const b = acc.bookmarks.find((x) => x.id === mBm[1]);
    if (!b) return send(res, 404, { error: "not-found" });
    if (method === "GET") return send(res, 200, { bookmark: publicBookmark(b) });
    if (method === "PATCH") {
      const body = await readBody(req);
      if (body.url !== undefined) {
        const raw = String(body.url).trim();
        if (!isPlausibleLink(raw)) return send(res, 400, { error: "not-a-link" });
        const norm = normalizeUrl(raw);
        const other = findByNorm(acc, norm, b.id);
        if (other) return send(res, 200, { duplicateId: other.id });
        b.url = ensureScheme(raw); b.norm = norm;
      }
      for (const k of ["title", "description", "note"]) if (k in body) b[k] = String(body[k]);
      if ("tags" in body) b.tags = cleanTags(body.tags);
      if ("status" in body && (body.status === "toread" || body.status === "finished")) b.status = body.status;
      if ("archived" in body) b.archived = !!body.archived;
      save();
      return send(res, 200, { bookmark: publicBookmark(b) });
    }
    if (method === "DELETE") {
      acc.bookmarks = acc.bookmarks.filter((x) => x.id !== b.id);
      save();
      return send(res, 200, { ok: true });
    }
  }

  const mCopy = path.match(/^\/api\/bookmarks\/([^/]+)\/copy$/);
  if (mCopy && method === "POST") {
    const b = acc.bookmarks.find((x) => x.id === mCopy[1]);
    if (!b) return send(res, 404, { error: "not-found" });
    const copy = await capture(b.url, b.id);
    if (!copy) return send(res, 200, { copy: null, failed: true });
    b.copy = copy; save();
    return send(res, 200, { copy });
  }

  const mIa = path.match(/^\/api\/bookmarks\/([^/]+)\/ia$/);
  if (mIa && method === "POST") {
    const b = acc.bookmarks.find((x) => x.id === mIa[1]);
    if (!b) return send(res, 404, { error: "not-found" });
    b.ia = await toInternetArchive(b.url); save();
    return send(res, 200, { ia: b.ia });
  }

  if (path === "/api/bulk" && method === "POST") {
    const body = await readBody(req);
    const ids = new Set(body.ids || []);
    const targets = acc.bookmarks.filter((b) => ids.has(b.id));
    const op = body.op;
    if (op === "delete") acc.bookmarks = acc.bookmarks.filter((b) => !ids.has(b.id));
    else targets.forEach((b) => {
      if (op === "toread" || op === "finished") b.status = op;
      else if (op === "archive") b.archived = true;
      else if (op === "restore") b.archived = false;
      else if (op === "addTags") b.tags = cleanTags([...(b.tags || []), ...(body.tags || [])]);
      else if (op === "removeTags") { const rm = new Set((body.tags || []).map(String)); b.tags = (b.tags || []).filter((t) => !rm.has(t)); }
    });
    save();
    return send(res, 200, { bookmarks: acc.bookmarks.map(publicBookmark) });
  }

  if (path === "/api/views" && method === "POST") {
    const body = await readBody(req);
    const view = { id: "v" + Date.now().toString(36), name: String(body.name || "Saved view"),
      search: String(body.search || ""), include: cleanTags(body.include), exclude: cleanTags(body.exclude) };
    acc.views.push(view); save();
    return send(res, 201, { view, views: acc.views });
  }
  const mView = path.match(/^\/api\/views\/([^/]+)$/);
  if (mView && method === "DELETE") {
    acc.views = acc.views.filter((v) => v.id !== mView[1]); save();
    return send(res, 200, { views: acc.views });
  }

  if (path === "/api/import" && method === "POST") {
    const body = await readBody(req);
    const items = parseNetscape(body.html || "");
    let added = 0, skipped = 0;
    for (const it of items) {
      if (!it.url || !isPlausibleLink(it.url)) { skipped++; continue; }
      const norm = normalizeUrl(it.url);
      if (findByNorm(acc, norm)) { skipped++; continue; }
      const ts = it.addDate ? it.addDate * 1000 : Date.now();
      acc.bookmarks.push({
        id: nextId(userId), url: ensureScheme(it.url), norm,
        title: it.title || it.url, description: "", site: safeHost(it.url),
        iconUrl: "", imageUrl: "", tags: cleanTags(it.tags), note: "",
        status: it.status === "finished" ? "finished" : "toread", archived: !!it.archived,
        autofilled: true, ts, savedLabel: savedLabel(ts), copy: null, ia: null,
      });
      added++;
    }
    save();
    return send(res, 200, { added, skipped, total: items.length, bookmarks: acc.bookmarks.map(publicBookmark) });
  }
  if (path === "/api/import/preview" && method === "POST") {
    const body = await readBody(req);
    const items = parseNetscape(body.html || "");
    let neu = 0, dup = 0;
    const sample = [];
    for (const it of items) {
      if (findByNorm(acc, normalizeUrl(it.url))) dup++;
      else { neu++; if (sample.length < 5) sample.push({ title: it.title || it.url, tags: it.tags }); }
    }
    return send(res, 200, { total: items.length, neu, dup, sample });
  }

  if (path === "/api/export" && method === "GET") {
    const html = buildNetscape(acc.bookmarks);
    res.writeHead(200, { "content-type": "text/html; charset=utf-8", "content-disposition": 'attachment; filename="my-bookmarks.html"' });
    return res.end(html);
  }

  if (TEST_MODE && path === "/api/reset" && method === "POST") {
    resetAccount(userId);
    return send(res, 200, { ok: true });
  }

  return send(res, 404, { error: "unknown-endpoint" });
}

function captureInBackground(userId, id, urlStr) {
  capture(urlStr, id).then((copy) => {
    if (!copy) return;
    const acc = getAccount(userId);
    const b = acc.bookmarks.find((x) => x.id === id);
    if (b) { b.copy = copy; save(); }
  }).catch(() => {});
}

function handleCopy(res, path, userId) {
  const id = decodeURIComponent(path.slice("/copy/".length));
  const acc = getAccount(userId);
  const b = acc.bookmarks.find((x) => x.id === id);
  if (!b || !b.copy || !b.copy.file) { res.writeHead(404); return res.end("No preserved copy"); }
  const p = snapshotPath(b.copy.file);
  if (!p) { res.writeHead(404); return res.end("Copy file missing"); }
  const type = b.copy.kind === "pdf" ? "application/pdf" : "text/html; charset=utf-8";
  res.writeHead(200, { "content-type": type });
  createReadStream(p).pipe(res);
}

function handleTestPage(res, path) {
  if (path.endsWith(".pdf")) {
    res.writeHead(200, { "content-type": "application/pdf" });
    return res.end("%PDF-1.4\n% test pdf\n");
  }
  const html = `<!doctype html><html><head><meta charset="utf-8">
<title>Sample Test Page Title</title>
<meta name="description" content="A sample page used by acceptance tests.">
<meta property="og:image" content="/testpage/img.png">
<link rel="icon" href="/favicon.ico"></head>
<body><h1>Sample</h1><p>Hello from the test page.</p></body></html>`;
  res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  res.end(html);
}

async function serveLib(res, path) {
  const file = join(__dirname, "src", path.slice("/lib/".length));
  const data = await readFile(file).catch(() => null);
  if (!data) { res.writeHead(404); return res.end("Not found"); }
  res.writeHead(200, { "content-type": "text/javascript; charset=utf-8" });
  res.end(data);
}

async function serveStatic(res, path) {
  let rel = path === "/" ? "/index.html" : path;
  rel = pathNormalize(rel).replace(/^(\.\.[/\\])+/, "");
  const file = join(PUBLIC, rel);
  if (!file.startsWith(PUBLIC) || !existsSync(file)) {
    // SPA fallback to index.html
    const idx = join(PUBLIC, "index.html");
    const html = await readFile(idx).catch(() => null);
    if (!html) { res.writeHead(404); return res.end("Not found"); }
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    return res.end(html);
  }
  const data = await readFile(file);
  res.writeHead(200, { "content-type": MIME[extname(file)] || "application/octet-stream" });
  res.end(data);
}

function cleanTags(arr) {
  if (!Array.isArray(arr)) return [];
  const seen = new Set(); const out = [];
  for (let t of arr) { t = String(t).trim().replace(/^#/, ""); if (t && !seen.has(t)) { seen.add(t); out.push(t); } }
  return out;
}
function safeHost(u) { try { return new URL(ensureScheme(u)).hostname.replace(/^www\./, ""); } catch { return ""; } }

server.listen(PORT, "0.0.0.0", () => {
  console.log(`My Bookmarks server listening on http://0.0.0.0:${PORT}`);
});
