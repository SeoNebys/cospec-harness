import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as store from "./src/db.js";
import { normalizeInput, urlKey } from "./src/normalize.js";
import { fetchMetadata } from "./src/metadata.js";
import { preserveCopy } from "./src/preserve.js";
import { submitToInternetArchive } from "./src/archive.js";
import { exportNetscape, importNetscape } from "./src/netscape.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json({ limit: "6mb" }));
app.use(express.text({ type: ["text/html", "text/plain"], limit: "25mb" }));
app.use(express.static(path.join(__dirname, "public")));
app.use("/shared", express.static(path.join(__dirname, "src")));

const PORT = process.env.PORT || 4000;

function sanitizeTags(tags) {
  if (!Array.isArray(tags)) return [];
  const seen = new Set();
  const out = [];
  for (const t of tags) {
    const s = String(t).trim();
    if (s && !seen.has(s.toLowerCase())) { seen.add(s.toLowerCase()); out.push(s); }
  }
  return out;
}

// Initial payload: bookmarks + saved filters + prefs.
app.get("/api/state", (req, res) => {
  res.json({ bookmarks: store.listBookmarks(), filters: store.listFilters(), prefs: store.getPrefs() });
});

// Step 1 of saving: normalize, detect an existing bookmark, and fetch metadata.
app.post("/api/metadata", async (req, res) => {
  const norm = normalizeInput(req.body && req.body.url);
  if (!norm.ok) return res.status(400).json({ ok: false, reason: norm.reason });
  const existing = store.getByKey(urlKey(norm.url));
  if (existing) return res.json({ ok: true, url: norm.url, existing });
  const meta = await fetchMetadata(norm.url);
  res.json({ ok: true, url: norm.url, meta });
});

app.post("/api/bookmarks", (req, res) => {
  const b = req.body || {};
  const norm = normalizeInput(b.url);
  if (!norm.ok) return res.status(400).json({ error: norm.reason });
  if (store.getByKey(urlKey(norm.url))) return res.status(409).json({ error: "already-exists", existing: store.getByKey(urlKey(norm.url)) });
  const created = store.insertBookmark({
    url: norm.url,
    title: (b.title || "").trim() || norm.url,
    description: (b.description || "").trim(),
    note: (b.note || "").trim(),
    tags: sanitizeTags(b.tags),
    readLater: !!b.readLater,
    archived: false,
    addedAt: Date.now(),
    fav: b.fav || "",
    preview: b.preview || "",
  });
  res.status(201).json(created);
});

app.put("/api/bookmarks/:id", (req, res) => {
  const id = Number(req.params.id);
  const cur = store.getBookmark(id);
  if (!cur) return res.status(404).json({ error: "not-found" });
  const b = req.body || {};
  const norm = normalizeInput(b.url != null ? b.url : cur.url);
  if (!norm.ok) return res.status(400).json({ error: norm.reason });
  const clash = store.getByKey(urlKey(norm.url));
  if (clash && clash.id !== id) return res.status(409).json({ error: "address-in-use" });
  const updated = store.updateBookmark(id, {
    url: norm.url,
    title: (b.title != null ? b.title : cur.title).trim() || norm.url,
    description: (b.description != null ? b.description : cur.description).trim(),
    note: b.note != null ? b.note : cur.note,
    tags: b.tags != null ? sanitizeTags(b.tags) : cur.tags,
    readLater: b.readLater != null ? !!b.readLater : cur.readLater,
    archived: b.archived != null ? !!b.archived : cur.archived,
    fav: b.fav != null ? b.fav : cur.fav,
    preview: b.preview != null ? b.preview : cur.preview,
  });
  res.json(updated);
});

app.delete("/api/bookmarks/:id", (req, res) => {
  store.deleteBookmark(Number(req.params.id));
  res.json({ ok: true });
});

// Bulk actions on an explicit list of ids (SCN-013). "Select all matching" is
// resolved to ids on the client and sent here.
app.post("/api/bookmarks/bulk", (req, res) => {
  const { ids, action, payload } = req.body || {};
  if (!Array.isArray(ids)) return res.status(400).json({ error: "ids required" });
  for (const id of ids) {
    const b = store.getBookmark(id);
    if (!b) continue;
    if (action === "delete") { store.deleteBookmark(id); continue; }
    const patch = { ...b };
    if (action === "read") patch.readLater = false;
    else if (action === "unread") patch.readLater = true;
    else if (action === "archive") patch.archived = true;
    else if (action === "restore") patch.archived = false;
    else if (action === "addTags") { patch.tags = sanitizeTags([...b.tags, ...(payload?.tags || [])]); }
    else if (action === "removeTags") {
      const rm = new Set((payload?.tags || []).map((t) => String(t).toLowerCase()));
      patch.tags = b.tags.filter((t) => !rm.has(t.toLowerCase()));
    }
    store.updateBookmark(id, patch);
  }
  res.json({ bookmarks: store.listBookmarks() });
});

app.post("/api/bookmarks/:id/preserve", async (req, res) => {
  const id = Number(req.params.id);
  const b = store.getBookmark(id);
  if (!b) return res.status(404).json({ error: "not-found" });
  try {
    const result = await preserveCopy(b.url);
    store.savePreservedContent(id, result.contentType, result.data);
    const updated = store.setPreserved(id, { at: Date.now(), kind: result.kind });
    res.json(updated);
  } catch (e) {
    res.status(502).json({ error: "preserve-failed", message: e && e.message ? e.message : "capture failed" });
  }
});

app.get("/preserved/:id", (req, res) => {
  const row = store.getPreservedContent(Number(req.params.id));
  if (!row) return res.status(404).send("No preserved copy.");
  res.setHeader("Content-Type", row.content_type);
  res.send(row.data);
});

app.post("/api/bookmarks/:id/internet-archive", async (req, res) => {
  const id = Number(req.params.id);
  const b = store.getBookmark(id);
  if (!b) return res.status(404).json({ error: "not-found" });
  const ia = await submitToInternetArchive(b.url);
  const updated = store.setIA(id, ia);
  res.json(updated);
});

app.post("/api/filters", (req, res) => {
  const f = req.body || {};
  if (!f.name || !String(f.name).trim()) return res.status(400).json({ error: "name required" });
  store.addFilter({ name: String(f.name).trim(), query: f.query || "", include: sanitizeTags(f.include), exclude: sanitizeTags(f.exclude) });
  res.status(201).json({ filters: store.listFilters() });
});
app.delete("/api/filters/:id", (req, res) => {
  store.deleteFilter(Number(req.params.id));
  res.json({ filters: store.listFilters() });
});

app.put("/api/prefs", (req, res) => {
  const { key, value } = req.body || {};
  if (!key) return res.status(400).json({ error: "key required" });
  store.setPref(key, value);
  res.json({ prefs: store.getPrefs() });
});

app.get("/api/export", (req, res) => {
  const html = exportNetscape(store.listBookmarks());
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="bookmarks.html"');
  res.send(html);
});

app.post("/api/import", (req, res) => {
  const html = typeof req.body === "string" ? req.body : (req.body && req.body.html) || "";
  const entries = importNetscape(html);
  let added = 0, skipped = 0;
  for (const e of entries) {
    if (store.getByKey(urlKey(e.url))) { skipped++; continue; }
    store.insertBookmark({
      url: e.url, title: e.title, description: e.description || "", note: "",
      tags: sanitizeTags(e.tags), readLater: false, archived: !!e.archived,
      addedAt: e.addedAt || Date.now(), fav: "", preview: "",
    });
    added++;
  }
  res.json({ added, skipped, total: entries.length, bookmarks: store.listBookmarks() });
});

export const httpServer = app.listen(PORT, "0.0.0.0", () => {
  console.log(`Bookmarks app listening on http://0.0.0.0:${PORT}`);
});

export default app;
