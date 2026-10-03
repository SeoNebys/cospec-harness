/*
 * Calm Bookmarks — production server.
 * REST API + static frontend. Behaviour follows the approved scenarios SCN-001..SCN-022
 * (see SCENARIO-MAP.md). Search/filter/sort/paginate happen in the browser for a live feel;
 * the server owns persistence, metadata fetch, preserved copies, Internet Archive, import/export.
 */
const express = require("express");
const fs = require("fs");
const path = require("path");
const store = require("./lib/store");
const meta = require("./lib/metadata");
const bh = require("./lib/bookmarksHtml");

const app = express();
app.use(express.json({ limit: "20mb" }));
app.use(express.text({ type: ["text/html", "text/plain"], limit: "20mb" }));

let state = store.load();
function persist() { store.save(state); }
function nextId() {
  const ids = state.bookmarks.map((b) => b.id).concat(state.collections.map((c) => c.id));
  return (ids.length ? Math.max(...ids) : 0) + 1;
}
const today = () => new Date().toISOString().slice(0, 10);
function find(id) { return state.bookmarks.find((b) => b.id === Number(id)); }

// --- read whole state ---
app.get("/api/state", (req, res) => res.json(state));

// --- metadata for the editor's auto-fill (SCN-001, SCN-011) ---
app.post("/api/fetch", async (req, res) => {
  const url = (req.body && req.body.url || "").trim();
  if (!store.looksLikeLink(url)) return res.status(400).json({ error: "not_a_link" });
  const m = await meta.fetchMetadata(url);
  res.json(m);
});

async function applyCopyAndIA(b, keepCopy, ia) {
  b.keepCopy = !!keepCopy;
  b.copyKind = null; b.capturedAt = null; b.copyFailed = false;
  if (keepCopy) {
    try {
      const r = await meta.captureSnapshot(String(b.id), b.url);
      b.copyKind = r.copyKind; b.capturedAt = r.capturedAt; b.copyFailed = false;
    } catch (e) { b.copyFailed = true; }
  }
  b.iaUrl = b.iaUrl || null;
  if (ia && !b.iaUrl) {
    try { b.iaUrl = await meta.submitInternetArchive(b.url); }
    catch (e) { b.iaError = true; }
  }
}

// --- create (SCN-001, SCN-003 duplicate, SCN-012 invalid, SCN-020 copy/IA) ---
app.post("/api/bookmarks", async (req, res) => {
  const body = req.body || {};
  const url = (body.url || "").trim();
  if (!store.looksLikeLink(url)) return res.status(400).json({ error: "not_a_link" });
  const existing = state.bookmarks.find((b) => store.normUrl(b.url) === store.normUrl(url));
  if (existing) return res.status(409).json({ error: "duplicate", existing });

  const b = {
    id: nextId(),
    url,
    domain: store.domainOf(url),
    title: (body.title || "").trim() || url,
    desc: (body.desc || "").trim(),
    note: (body.note || "").trim(),
    tags: Array.isArray(body.tags) ? body.tags.filter(Boolean) : [],
    readLater: body.readLater !== false,
    archived: false,
    addedAt: today(),
    preview: body.preview || null,
    favicon: body.favicon || null,
    iaUrl: null,
  };
  await applyCopyAndIA(b, body.keepCopy !== false, !!body.ia);
  state.bookmarks.unshift(b);
  persist();
  res.status(201).json({ bookmark: b });
});

// --- update, incl. address change with clash safeguard (SCN-004) ---
app.put("/api/bookmarks/:id", async (req, res) => {
  const b = find(req.params.id);
  if (!b) return res.status(404).json({ error: "not_found" });
  const body = req.body || {};
  const newUrl = (body.url != null ? body.url : b.url).trim();
  if (!store.looksLikeLink(newUrl)) return res.status(400).json({ error: "not_a_link" });
  const clash = state.bookmarks.find((x) => x.id !== b.id && store.normUrl(x.url) === store.normUrl(newUrl));
  if (clash) return res.status(409).json({ error: "duplicate", existing: clash });

  const urlChanged = store.normUrl(newUrl) !== store.normUrl(b.url);
  b.url = newUrl;
  b.domain = store.domainOf(newUrl);
  if (body.title != null) b.title = body.title.trim() || newUrl;
  if (body.desc != null) b.desc = body.desc.trim();
  if (body.note != null) b.note = body.note.trim();
  if (Array.isArray(body.tags)) b.tags = body.tags.filter(Boolean);
  if (body.readLater != null) b.readLater = !!body.readLater;

  // Copy/IA: (re)capture if newly requested or address changed
  if (body.keepCopy != null) {
    if (body.keepCopy && (urlChanged || !b.capturedAt)) await applyCopyAndIA(b, true, false);
    else if (!body.keepCopy) { b.keepCopy = false; }
  } else if (urlChanged && b.keepCopy) {
    await applyCopyAndIA(b, true, false);
  }
  if (body.ia && !b.iaUrl) {
    try { b.iaUrl = await meta.submitInternetArchive(b.url); } catch (e) { b.iaError = true; }
  }
  persist();
  res.json({ bookmark: b });
});

// --- delete permanently (SCN-017) ---
app.delete("/api/bookmarks/:id", (req, res) => {
  const b = find(req.params.id);
  if (!b) return res.status(404).json({ error: "not_found" });
  state.bookmarks = state.bookmarks.filter((x) => x.id !== b.id);
  for (const ext of ["html", "pdf"]) {
    const f = path.join(store.SNAP_DIR, b.id + "." + ext);
    if (fs.existsSync(f)) fs.unlinkSync(f);
  }
  persist();
  res.json({ ok: true });
});

// --- retry capturing a preserved copy (SCN-020) ---
app.post("/api/bookmarks/:id/capture", async (req, res) => {
  const b = find(req.params.id);
  if (!b) return res.status(404).json({ error: "not_found" });
  b.keepCopy = true;
  try {
    const r = await meta.captureSnapshot(String(b.id), b.url);
    b.copyKind = r.copyKind; b.capturedAt = r.capturedAt; b.copyFailed = false;
  } catch (e) { b.copyFailed = true; b.capturedAt = null; }
  persist();
  res.json({ bookmark: b });
});

// --- bulk actions (SCN-016) ---
app.post("/api/bulk", (req, res) => {
  const { ids = [], op, value } = req.body || {};
  const idSet = new Set(ids.map(Number));
  const sel = state.bookmarks.filter((b) => idSet.has(b.id));
  switch (op) {
    case "read": sel.forEach((b) => (b.readLater = false)); break;
    case "unread": sel.forEach((b) => (b.readLater = true)); break;
    case "archive": sel.forEach((b) => (b.archived = true)); break;
    case "restore": sel.forEach((b) => (b.archived = false)); break;
    case "delete":
      state.bookmarks = state.bookmarks.filter((b) => !idSet.has(b.id));
      sel.forEach((b) => { for (const ext of ["html", "pdf"]) { const f = path.join(store.SNAP_DIR, b.id + "." + ext); if (fs.existsSync(f)) fs.unlinkSync(f); } });
      break;
    case "addLabel":
      if (value) sel.forEach((b) => { b.tags = b.tags || []; if (!b.tags.some((t) => t.toLowerCase() === value.toLowerCase())) b.tags.push(value); });
      break;
    case "removeLabel":
      if (value) sel.forEach((b) => { b.tags = (b.tags || []).filter((t) => t.toLowerCase() !== value.toLowerCase()); });
      break;
    default: return res.status(400).json({ error: "bad_op" });
  }
  persist();
  res.json({ ok: true });
});

// --- serve a preserved copy (SCN-020) ---
app.get("/api/snapshot/:id", (req, res) => {
  const b = find(req.params.id);
  const htmlF = path.join(store.SNAP_DIR, req.params.id + ".html");
  const pdfF = path.join(store.SNAP_DIR, req.params.id + ".pdf");
  if (fs.existsSync(pdfF)) { res.type("application/pdf"); return res.sendFile(pdfF); }
  if (fs.existsSync(htmlF)) { res.type("text/html"); return res.sendFile(htmlF); }
  res.status(404).send("No preserved copy for this bookmark" + (b ? "" : " (unknown bookmark)") + ".");
});

// --- export whole collection incl. archived (SCN-021) ---
app.get("/api/export", (req, res) => {
  res.setHeader("Content-Disposition", 'attachment; filename="bookmarks.html"');
  res.type("text/html");
  res.send(bh.generate(state.bookmarks));
});

// --- import standard bookmark HTML (SCN-021) ---
app.post("/api/import", (req, res) => {
  const html = typeof req.body === "string" ? req.body : (req.body && req.body.html) || "";
  const items = bh.parse(html);
  let added = 0, skipped = 0;
  for (const it of items) {
    if (state.bookmarks.some((b) => store.normUrl(b.url) === store.normUrl(it.url))) { skipped++; continue; }
    state.bookmarks.push({
      id: nextId(),
      url: it.url,
      domain: store.domainOf(it.url),
      title: it.title || it.url,
      desc: "",
      note: "",
      tags: it.tags || [],
      readLater: true,
      archived: false,
      addedAt: it.addedAt || today(),
      keepCopy: false, copyKind: null, capturedAt: null, copyFailed: false, iaUrl: null,
    });
    added++;
  }
  persist();
  res.json({ added, skipped });
});

// --- collections (SCN-018) ---
app.post("/api/collections", (req, res) => {
  const { name, query } = req.body || {};
  if (!name) return res.status(400).json({ error: "name_required" });
  const c = { id: nextId(), name: String(name).trim(), query: String(query || "").trim() };
  state.collections.push(c);
  persist();
  res.status(201).json({ collection: c });
});
app.delete("/api/collections/:id", (req, res) => {
  state.collections = state.collections.filter((c) => c.id !== Number(req.params.id));
  persist();
  res.json({ ok: true });
});

// --- preferences (SCN-014 sort, SCN-022 text size / items shown) ---
app.put("/api/prefs", (req, res) => {
  state.prefs = { ...state.prefs, ...(req.body || {}) };
  persist();
  res.json({ prefs: state.prefs });
});

app.use(express.static(path.join(__dirname, "public")));
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));

const PORT = process.env.PORT || 4000;
const HOST = "0.0.0.0";
if (require.main === module) {
  app.listen(PORT, HOST, () => console.log(`Calm Bookmarks running on http://${HOST}:${PORT}`));
}
module.exports = app;
