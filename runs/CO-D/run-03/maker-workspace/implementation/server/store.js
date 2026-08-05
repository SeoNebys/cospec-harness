'use strict';
// The store: JSON persistence plus every business operation, mapped to scenarios.
// `capture` is injected so the logic can be tested without a network.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { looksLikeUrl, normUrl } = require('./url');
const { searchRecords, describe } = require('./search');
const { parseBookmarks, foldersToLabels } = require('./importer');

function createStore({ dataDir, capture, now }) {
  const dbFile = path.join(dataDir, 'db.json');
  const clock = now || (() => new Date().toISOString());
  let state = { bookmarks: [] };
  const jobs = new Map();

  fs.mkdirSync(dataDir, { recursive: true });
  if (fs.existsSync(dbFile)) {
    try { state = JSON.parse(fs.readFileSync(dbFile, 'utf8')); } catch { state = { bookmarks: [] }; }
  }
  if (!Array.isArray(state.bookmarks)) state.bookmarks = [];

  function persist() {
    fs.writeFileSync(dbFile, JSON.stringify(state, null, 2));
  }
  const live = () => state.bookmarks.filter((b) => !b.deleted);
  const byId = (id) => state.bookmarks.find((b) => b.id === id && !b.deleted);
  function findByUrl(url) {
    const key = normUrl(url);
    return live().find((b) => normUrl(b.url) === key);
  }

  // Strip heavy/internal fields for list payloads (keeps the copy text off the wire).
  function summarize(b) {
    return {
      id: b.id, url: b.url, title: b.title, summary: b.summary, imageUrl: b.imageUrl,
      labels: b.labels, unread: b.unread, archived: b.archived, savedAt: b.savedAt,
      copyStatus: b.copyStatus, captureFailed: b.captureFailed, originalGone: b.originalGone,
      hasCopy: b.copyStatus === 'kept' && !!b.copyText,
    };
  }

  // --- scope (SCN-018) + archived exclusion (SCN-008) ---
  function scoped({ view, label }) {
    let pool = live();
    if (view === 'archived') pool = pool.filter((b) => b.archived);
    else {
      pool = pool.filter((b) => !b.archived);
      if (view === 'toread') pool = pool.filter((b) => b.unread);
    }
    if (view !== 'archived' && label) pool = pool.filter((b) => (b.labels || []).includes(label));
    return pool;
  }

  function counts() {
    const act = live().filter((b) => !b.archived);
    return {
      all: act.length,
      toread: act.filter((b) => b.unread).length,
      archived: live().filter((b) => b.archived).length,
    };
  }

  function labelList() {
    const s = new Set();
    live().filter((b) => !b.archived).forEach((b) => (b.labels || []).forEach((l) => s.add(l)));
    return [...s].sort();
  }

  // Default order is newest-first (SCN-020 keeps original dates; full ordering options are next cycle).
  function list({ view = 'all', label = null } = {}) {
    const pool = scoped({ view, label }).slice()
      .sort((a, b) => String(b.savedAt).localeCompare(String(a.savedAt)));
    return { items: pool.map(summarize), counts: counts(), labels: labelList() };
  }

  function search({ q, view = 'all', label = null } = {}) {
    const pool = scoped({ view, label });
    const { parsed, results } = searchRecords(pool, q || '');
    const map = new Map(state.bookmarks.map((b) => [b.id, b]));
    return {
      interpretation: describe(parsed),
      firstWeakIndex: results.findIndex((r) => !r.strong),
      items: results.map((r) => ({ ...summarize(map.get(r.id)), match: { why: r.why, strong: r.strong, snippet: r.snippet } })),
      counts: counts(), labels: labelList(),
    };
  }

  function getCopy(id) {
    const b = byId(id);
    if (!b) return null;
    return {
      id: b.id, url: b.url, title: b.title, summary: b.summary,
      copyStatus: b.copyStatus, originalGone: b.originalGone, copyText: b.copyText || '',
    };
  }

  // --- create (SCN-001, SCN-004, SCN-012, SCN-013, SCN-015) ---
  async function create({ url, unread = false }) {
    const clean = looksLikeUrl(url);
    if (!clean) { const e = new Error('That doesn\'t look like a web address — check it and try again.'); e.code = 'invalid'; throw e; }
    const existing = findByUrl(clean);
    if (existing) return { status: 'duplicate', item: summarize(existing) };

    const cap = await capture(clean);
    const rec = baseRecord(clean, clock());
    rec.unread = !!unread;
    if (cap.ok) {
      rec.title = cap.title || '';
      rec.summary = cap.summary || '';
      rec.imageUrl = cap.imageUrl || null;
      rec.copyText = cap.copyText || '';
      rec.copyStatus = rec.copyText ? 'kept' : 'none';
      rec.captureFailed = !rec.title;
    } else {
      // Couldn't read the page: save anyway, flag for a title (never block saving).
      rec.captureFailed = true;
      rec.copyStatus = 'failed';
    }
    state.bookmarks.push(rec);
    persist();
    return { status: 'created', item: summarize(rec), needsTitle: rec.captureFailed };
  }

  function baseRecord(url, savedAt) {
    return {
      id: crypto.randomUUID(), url, title: '', summary: '', imageUrl: null,
      labels: [], unread: false, archived: false, deleted: false,
      savedAt, copyText: '', copyStatus: 'none', captureFailed: false, originalGone: false,
    };
  }

  // --- edit (SCN-003, SCN-005) ---
  function update(id, { title, url, summary, labels }) {
    const b = byId(id);
    if (!b) return null;
    if (typeof title === 'string') b.title = title.trim();
    if (typeof summary === 'string') b.summary = summary.trim();
    if (typeof url === 'string') { const c = looksLikeUrl(url); if (c) b.url = c; }
    if (Array.isArray(labels)) b.labels = [...new Set(labels.map((l) => String(l).trim()).filter(Boolean))];
    if (b.title) b.captureFailed = false;
    persist();
    return summarize(b);
  }

  // --- deliberate re-fetch for a changed address (SCN-009) ---
  async function refetch(id, { url }) {
    const b = byId(id);
    if (!b) return null;
    const clean = looksLikeUrl(url || b.url) || b.url;
    const cap = await capture(clean);
    if (!cap.ok) return { ok: false, item: summarize(b) };
    b.url = clean;
    b.title = cap.title || b.title;
    b.summary = cap.summary || b.summary;
    b.imageUrl = cap.imageUrl || b.imageUrl;
    b.copyText = cap.copyText || b.copyText;
    b.copyStatus = b.copyText ? 'kept' : b.copyStatus;
    b.originalGone = false;
    if (b.title) b.captureFailed = false;
    persist();
    return { ok: true, item: summarize(b) };
  }

  // --- status toggles (SCN-010 to-read, SCN-008 archive) ---
  function setToRead(id, value) { const b = byId(id); if (!b) return null; b.unread = !!value; persist(); return summarize(b); }
  function setArchived(id, value) { const b = byId(id); if (!b) return null; b.archived = !!value; persist(); return summarize(b); }

  // --- delete with undo (SCN-006) — soft-delete, purge after the undo window ---
  function remove(id) {
    const b = byId(id);
    if (!b) return null;
    b.deleted = true;
    b._purgeAt = Date.now() + 12000;
    persist();
    return { id };
  }
  function undelete(id) {
    const b = state.bookmarks.find((x) => x.id === id && x.deleted);
    if (!b) return null;
    b.deleted = false;
    delete b._purgeAt;
    persist();
    return summarize(b);
  }
  function purgeExpired() {
    const t = Date.now();
    const before = state.bookmarks.length;
    state.bookmarks = state.bookmarks.filter((b) => !(b.deleted && b._purgeAt && b._purgeAt <= t));
    if (state.bookmarks.length !== before) persist();
  }

  // --- import (SCN-020) ---
  function importStart(text, { foldersAsLabels = true } = {}) {
    const parsed = parseBookmarks(text);
    const jobId = crypto.randomUUID();
    const job = {
      id: jobId, total: parsed.items.length, processed: 0, done: false,
      summary: { added: 0, duplicates: 0, needsTitle: 0, dead: 0, kind: parsed.kind },
    };
    jobs.set(jobId, job);
    // Process asynchronously so the client can watch progress / run it in the background.
    runImport(job, parsed, foldersAsLabels).catch((err) => { job.error = String(err); job.done = true; });
    return job;
  }

  async function runImport(job, parsed, foldersAsLabels) {
    const seen = new Set(live().map((b) => normUrl(b.url)));
    for (const it of parsed.items) {
      const clean = looksLikeUrl(it.url);
      if (!clean) { job.processed++; continue; }
      const key = normUrl(clean);
      if (seen.has(key)) { job.summary.duplicates++; job.processed++; continue; }
      seen.add(key);

      const rec = baseRecord(clean, it.date || clock());
      if (parsed.kind === 'own' && it._full) {
        // Round-trip of our own export: keep everything as-is.
        Object.assign(rec, it._full, { id: rec.id, deleted: false });
        rec.labels = Array.isArray(rec.labels) ? rec.labels : [];
      } else {
        rec.labels = foldersAsLabels ? foldersToLabels(it.folder) : [];
        const cap = await capture(clean);
        if (cap.ok) {
          rec.title = cap.title || it.title || '';
          rec.summary = cap.summary || '';
          rec.imageUrl = cap.imageUrl || null;
          rec.copyText = cap.copyText || '';
          rec.copyStatus = rec.copyText ? 'kept' : 'none';
          if (!rec.title) { rec.captureFailed = true; job.summary.needsTitle++; }
        } else {
          // Already dead before the move: bring it in honestly, no copy, flagged.
          rec.title = it.title || '';
          rec.originalGone = true;
          rec.copyStatus = 'none';
          job.summary.dead++;
        }
      }
      state.bookmarks.push(rec);
      job.summary.added++;
      job.processed++;
    }
    persist();
    job.done = true;
  }

  function importStatus(jobId) { return jobs.get(jobId) || null; }

  // --- export everything, portable, copies included (SCN-020) ---
  function exportAll() {
    return {
      app: 'bookmarks-app', version: 1, exportedAt: clock(),
      bookmarks: live().map((b) => ({
        url: b.url, title: b.title, summary: b.summary, imageUrl: b.imageUrl,
        labels: b.labels, unread: b.unread, archived: b.archived, savedAt: b.savedAt,
        copyStatus: b.copyStatus, originalGone: b.originalGone, copyText: b.copyText,
      })),
    };
  }

  return {
    list, search, getCopy, create, update, refetch, setToRead, setArchived,
    remove, undelete, purgeExpired, importStart, importStatus, exportAll,
    _state: state,
  };
}

module.exports = { createStore };
