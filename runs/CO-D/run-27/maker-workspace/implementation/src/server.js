// Dependency-free HTTP server: static frontend + JSON API. Node built-ins only.
import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import { dirname, join, normalize as pnorm, extname } from "node:path";
import { fileURLToPath } from "node:url";
import * as auth from "./auth.js";
import * as repo from "./repo.js";
import { fetchMetadata, captureSnapshot, archiveOnline } from "./metadata.js";
import { normalize, isValidWebUrl, withScheme } from "./public/shared/normalize.js";
import { normalizeTag } from "./public/shared/md.js";
import { deriveVisual } from "./public/shared/visuals.js";
import { seedReviewAccount } from "./seed.js";

const here = dirname(fileURLToPath(import.meta.url));
const PUBLIC = join(here, "public");
const PORT = process.env.PORT || 4000;

const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".ico": "image/x-icon", ".json": "application/json" };

function send(res, code, body, headers = {}) {
  res.writeHead(code, { "Cache-Control": "no-store", ...headers });
  res.end(body);
}
function json(res, code, obj, headers = {}) { send(res, code, JSON.stringify(obj), { "Content-Type": "application/json", ...headers }); }
function parseCookies(req) {
  const out = {}; (req.headers.cookie || "").split(";").forEach((p) => { const i = p.indexOf("="); if (i > 0) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim()); });
  return out;
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = ""; let size = 0;
    req.on("data", (c) => { size += c.length; if (size > 60 * 1024 * 1024) { reject(new Error("too large")); req.destroy(); } data += c; });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}
async function readJson(req) { const b = await readBody(req); return b ? JSON.parse(b) : {}; }

async function serveStatic(req, res, urlPath) {
  let rel = urlPath === "/" ? "/index.html" : urlPath;
  const full = pnorm(join(PUBLIC, rel));
  if (!full.startsWith(PUBLIC)) return send(res, 403, "Forbidden");
  try {
    const st = await stat(full);
    if (st.isDirectory()) return send(res, 404, "Not found");
    const body = await readFile(full);
    send(res, 200, body, { "Content-Type": MIME[extname(full)] || "application/octet-stream" });
  } catch { send(res, 404, "Not found"); }
}

function currentUser(req) { return auth.userForSession(parseCookies(req)["sid"]); }

// Build a bookmark object from client input, filling visuals if absent.
function normalizeIncoming(b) {
  const url = withScheme(b.url);
  const vis = (b.icon && b.preview) ? { icon: b.icon, preview: b.preview } : deriveVisual(url);
  return {
    url, title: (b.title || url).trim(), description: b.description || "",
    icon: vis.icon, preview: vis.preview,
    tags: Array.isArray(b.tags) ? [...new Set(b.tags.map(normalizeTag).filter(Boolean))] : [],
    note: b.note || "", toRead: b.toRead === true, archived: b.archived === true,
    savedAt: b.savedAt || undefined, editedAt: b.editedAt || undefined,
  };
}

const server = http.createServer(async (req, res) => {
  try {
    const u = new URL(req.url, "http://localhost");
    const path = u.pathname;
    const method = req.method;

    if (!path.startsWith("/api/")) return serveStatic(req, res, path);

    // ---- auth endpoints (no session required) ----
    if (path === "/api/register" && method === "POST") {
      const b = await readJson(req);
      let user; try { user = auth.createUser(b.email, b.password); } catch (e) { return json(res, 400, { error: e.message }); }
      const sid = auth.startSession(user.id);
      return json(res, 200, { email: user.email }, { "Set-Cookie": cookie(sid) });
    }
    if (path === "/api/login" && method === "POST") {
      const b = await readJson(req);
      const user = auth.verifyUser(b.email, b.password);
      if (!user) return json(res, 401, { error: "Wrong email or password." });
      const sid = auth.startSession(user.id);
      return json(res, 200, { email: user.email }, { "Set-Cookie": cookie(sid) });
    }
    if (path === "/api/logout" && method === "POST") {
      auth.endSession(parseCookies(req)["sid"]);
      return json(res, 200, { ok: true }, { "Set-Cookie": "sid=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax" });
    }
    if (path === "/api/me" && method === "GET") {
      const user = currentUser(req);
      return user ? json(res, 200, { email: user.email }) : json(res, 401, { error: "Not signed in." });
    }

    // ---- everything below requires a session ----
    const user = currentUser(req);
    if (!user) return json(res, 401, { error: "Not signed in." });
    const uid = user.id;

    if (path === "/api/bookmarks" && method === "GET") return json(res, 200, { bookmarks: repo.list(uid) });

    if (path === "/api/fetch-metadata" && method === "POST") {
      const b = await readJson(req);
      const url = withScheme(b.url);
      if (!isValidWebUrl(url)) return json(res, 400, { error: "That doesn't look like a valid web address." });
      const meta = await fetchMetadata(url);
      return json(res, 200, { url, ...meta });
    }

    if (path === "/api/bookmarks" && method === "POST") {
      const b = await readJson(req);
      const url = withScheme(b.url);
      if (!isValidWebUrl(url)) return json(res, 400, { error: "That doesn't look like a valid web address." });
      const existing = repo.rawByNorm(uid, normalize(url));
      if (existing) return json(res, 409, { error: "already-saved", id: existing.id });
      return json(res, 200, { bookmark: repo.create(uid, normalizeIncoming({ ...b, url })) });
    }

    if (path === "/api/bookmarks/import" && method === "POST") {
      const b = await readJson(req);
      const incoming = Array.isArray(b.bookmarks) ? b.bookmarks : [];
      const seen = new Set(repo.list(uid).map((x) => x.norm));
      let added = 0, skipped = 0;
      for (const raw of incoming) {
        const url = withScheme(raw.url || "");
        if (!isValidWebUrl(url)) { skipped++; continue; }
        const n = normalize(url);
        if (seen.has(n)) { skipped++; continue; }
        seen.add(n);
        const created = repo.create(uid, normalizeIncoming({ ...raw, url }));
        // Restore rich backup details (saved copy, Internet Archive, dates already set).
        const snap = raw.snapshot;
        if (snap && snap.kind === "pdf" && snap.pdfBase64) repo.setSnapshot(uid, created.id, { kind: "pdf", mime: snap.mime || "application/pdf", bytes: new Uint8Array(Buffer.from(snap.pdfBase64, "base64")), capturedAt: snap.capturedAt });
        else if (snap && snap.kind === "page" && snap.content) repo.setSnapshot(uid, created.id, { kind: "page", mime: snap.mime || "text/html", content: snap.content, capturedAt: snap.capturedAt });
        if (raw.archiveUrl) repo.setArchive(uid, created.id, { url: raw.archiveUrl, archivedAt: raw.archivedAt || Date.now() });
        added++;
      }
      return json(res, 200, { added, skipped, bookmarks: repo.list(uid) });
    }

    if (path === "/api/bookmarks/bulk" && method === "POST") {
      const b = await readJson(req);
      const ids = Array.isArray(b.ids) ? b.ids : [];
      let n = 0;
      for (const bid of ids) {
        if (b.action === "readlater") { if (repo.update(uid, bid, { toRead: true, touch: false })) n++; }
        else if (b.action === "read") { if (repo.update(uid, bid, { toRead: false, touch: false })) n++; }
        else if (b.action === "archive") { if (repo.update(uid, bid, { archived: true, touch: false })) n++; }
        else if (b.action === "restore") { if (repo.update(uid, bid, { archived: false, touch: false })) n++; }
        else if (b.action === "delete") { if (repo.remove(uid, bid)) n++; }
        else if (b.action === "addtag" || b.action === "removetag") {
          const tag = normalizeTag(b.tag); if (!tag) continue;
          const cur = repo.get(uid, bid); if (!cur) continue;
          let tags = cur.tags.slice();
          if (b.action === "addtag") { if (tags.indexOf(tag) < 0) tags.push(tag); }
          else tags = tags.filter((t) => t !== tag);
          repo.update(uid, bid, { tags }); n++;
        }
      }
      return json(res, 200, { changed: n, bookmarks: repo.list(uid) });
    }

    // /api/bookmarks/:id(/sub)
    const m = path.match(/^\/api\/bookmarks\/([^/]+)(?:\/(\w+))?(?:\/(\w+))?$/);
    if (m) {
      const bid = m[1], sub = m[2];
      if (!sub && method === "PATCH") {
        const b = await readJson(req);
        if ("url" in b) { const url = withScheme(b.url); if (!isValidWebUrl(url)) return json(res, 400, { error: "That doesn't look like a valid web address." });
          const clash = repo.rawByNorm(uid, normalize(url)); if (clash && clash.id !== bid) return json(res, 409, { error: "clash", title: clash.title });
          b.url = url; }
        if ("tags" in b) b.tags = [...new Set((b.tags || []).map(normalizeTag).filter(Boolean))];
        const updated = repo.update(uid, bid, b);
        return updated ? json(res, 200, { bookmark: updated }) : json(res, 404, { error: "Not found." });
      }
      if (!sub && method === "DELETE") return repo.remove(uid, bid) ? json(res, 200, { ok: true }) : json(res, 404, { error: "Not found." });

      if (sub === "snapshot" && method === "POST") {
        const cur = repo.get(uid, bid); if (!cur) return json(res, 404, { error: "Not found." });
        try { const snap = await captureSnapshot(cur.url); return json(res, 200, { bookmark: repo.setSnapshot(uid, bid, snap) }); }
        catch { return json(res, 502, { error: "Couldn't reach the page to save a copy." }); }
      }
      if (sub === "snapshot" && method === "DELETE") return json(res, 200, { bookmark: repo.removeSnapshot(uid, bid) });
      if (sub === "snapshot" && m[3] === "file" && method === "GET") {
        const s = repo.snapshotContent(uid, bid);
        if (!s) return send(res, 404, "Not found");
        if (s.kind === "pdf") { if (!s.bytes) return send(res, 404, "Not found"); return send(res, 200, Buffer.from(s.bytes), { "Content-Type": s.mime || "application/pdf" }); }
        // Preserved page: served as a standalone HTML document. Scripts were removed
        // at capture; a strict CSP is an extra guard for this stored third-party HTML.
        return send(res, 200, s.content || "", { "Content-Type": "text/html; charset=utf-8", "Content-Security-Policy": "script-src 'none'; sandbox allow-same-origin" });
      }
      if (sub === "snapshot" && method === "GET") {
        const s = repo.snapshotContent(uid, bid);
        return s ? json(res, 200, { kind: s.kind, capturedAt: s.capturedAt }) : json(res, 404, { error: "No copy." });
      }
      if (sub === "archive" && method === "POST") {
        const cur = repo.get(uid, bid); if (!cur) return json(res, 404, { error: "Not found." });
        const a = await archiveOnline(cur.url);
        return json(res, 200, { bookmark: repo.setArchive(uid, bid, a) });
      }
      if (sub === "archive" && method === "DELETE") return json(res, 200, { bookmark: repo.removeArchive(uid, bid) });
    }

    if (path === "/api/export" && method === "GET") return json(res, 200, { app: "my-bookmarks", version: 1, exportedAt: new Date().toISOString(), bookmarks: repo.exportAll(uid) });

    if (path === "/api/prefs" && method === "GET") return json(res, 200, repo.getPrefs(uid));
    if (path === "/api/prefs" && method === "PUT") { const b = await readJson(req); return json(res, 200, repo.setPrefs(uid, b)); }

    if (path === "/api/views" && method === "GET") return json(res, 200, { views: repo.listViews(uid) });
    if (path === "/api/views" && method === "POST") { const b = await readJson(req); if (!String(b.name || "").trim()) return json(res, 400, { error: "Please name the view." }); return json(res, 200, { views: repo.createView(uid, b) }); }
    const vm = path.match(/^\/api\/views\/([^/]+)$/);
    if (vm && method === "DELETE") return json(res, 200, { views: repo.deleteView(uid, vm[1]) });

    return json(res, 404, { error: "Unknown endpoint." });
  } catch (e) {
    json(res, 500, { error: "Server error." });
  }
});

function cookie(sid) { return `sid=${sid}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${60 * 60 * 24 * 365}`; }

seedReviewAccount();
server.listen(PORT, "0.0.0.0", () => console.log("My Bookmarks listening on http://0.0.0.0:" + PORT));
