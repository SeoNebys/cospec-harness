/*
 * JSON-file persistence for bookmarks, collections and settings.
 * Single-user personal scale. All mutations go through here.
 */
const fs = require('fs');
const path = require('path');
const { normalizeUrl, dupKey, preferHttps } = require('./normalize');

const DEFAULT_SETTINGS = { defaultSort: 'newest', autoLocalCopy: false, textSize: 'medium', perPage: 25 };

const FAV_COLORS = ['#2f6df6', '#e2528b', '#12a150', '#f59e0b', '#8b5cf6', '#0891b2', '#dc2626'];
function fallbackFavicon(u) {
  const host = u.hostname.replace(/^www\./, '');
  let s = 0; for (const c of host) s += c.charCodeAt(0);
  return { letter: (host.charAt(0) || '?').toUpperCase(), color: FAV_COLORS[s % FAV_COLORS.length] };
}

class Store {
  constructor(file) {
    this.file = file;
    this.data = { bookmarks: [], collections: [], settings: { ...DEFAULT_SETTINGS }, seq: 1 };
    this._load();
  }
  _load() {
    try {
      const raw = fs.readFileSync(this.file, 'utf8');
      const d = JSON.parse(raw);
      this.data = {
        bookmarks: d.bookmarks || [],
        collections: d.collections || [],
        settings: { ...DEFAULT_SETTINGS, ...(d.settings || {}) },
        seq: d.seq || (Math.max(0, ...(d.bookmarks || []).map(b => Number(b.id) || 0)) + 1)
      };
    } catch (e) { this._save(); }
  }
  _save() {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    fs.writeFileSync(this.file, JSON.stringify(this.data, null, 2));
  }
  _id() { return String(this.data.seq++); }

  // ---- bookmarks ----
  all() { return this.data.bookmarks; }
  find(id) { return this.data.bookmarks.find(b => b.id === id); }
  findByKey(href) { const k = dupKey(href); return this.data.bookmarks.find(b => dupKey(b.url) === k); }

  create(fields) {
    const u = normalizeUrl(fields.url);
    if (!u) return { error: 'invalid-url' };
    const existing = this.findByKey(u.href);
    if (existing) {
      // prefer https on http/https conflict; never duplicate
      existing.url = preferHttps(existing.url, u.href);
      this._save();
      return { duplicate: existing };
    }
    const now = Date.now();
    const b = {
      id: this._id(),
      url: u.href,
      title: (fields.title || u.hostname).trim(),
      description: fields.description || '',
      note: fields.note || '',
      tags: normTags(fields.tags),
      readLater: !!fields.readLater,
      archived: !!fields.archived,
      addedAt: fields.addedAt || now,
      updatedAt: fields.updatedAt || fields.addedAt || now,
      favicon: { real: fields.favicon && fields.favicon.real || null, fallback: fallbackFavicon(u) },
      preview: fields.preview || null,
      snapshot: null,
      archiveUrl: null
    };
    this.data.bookmarks.push(b);
    this._save();
    return { bookmark: b };
  }

  update(id, patch) {
    const b = this.find(id);
    if (!b) return { error: 'not-found' };
    if (patch.url !== undefined) {
      const u = normalizeUrl(patch.url);
      if (!u) return { error: 'invalid-url' };
      const clash = this.data.bookmarks.find(x => x.id !== id && dupKey(x.url) === dupKey(u.href));
      if (clash) return { error: 'address-conflict', conflict: { id: clash.id, title: clash.title, archived: clash.archived } };
      if (dupKey(b.url) !== dupKey(u.href)) b.favicon = { real: null, fallback: fallbackFavicon(u) };
      b.url = u.href;
    }
    for (const k of ['title', 'description', 'note']) if (patch[k] !== undefined) b[k] = patch[k];
    if (patch.tags !== undefined) b.tags = normTags(patch.tags);
    if (patch.readLater !== undefined) b.readLater = !!patch.readLater;
    if (patch.archived !== undefined) b.archived = !!patch.archived;
    if (patch.favicon !== undefined) b.favicon = { real: patch.favicon.real || null, fallback: b.favicon.fallback };
    if (patch.preview !== undefined) b.preview = patch.preview;
    if (patch.snapshot !== undefined) b.snapshot = patch.snapshot;
    if (patch.archiveUrl !== undefined) b.archiveUrl = patch.archiveUrl;
    // "updated" reflects detail edits (title/description/note/tags/url) — SCN-013
    const detailTouched = ['title', 'description', 'note', 'tags', 'url'].some(k => patch[k] !== undefined);
    if (detailTouched && patch._touch !== false) b.updatedAt = Date.now();
    this._save();
    return { bookmark: b };
  }

  remove(id) {
    const i = this.data.bookmarks.findIndex(b => b.id === id);
    if (i < 0) return { error: 'not-found' };
    const [removed] = this.data.bookmarks.splice(i, 1);
    this._save();
    return { removed };
  }

  // ---- settings ----
  getSettings() { return this.data.settings; }
  setSettings(patch) {
    this.data.settings = { ...this.data.settings, ...patch };
    this._save();
    return this.data.settings;
  }

  // ---- collections ----
  getCollections() { return this.data.collections; }
  addCollection(name, query, tags) {
    const c = { id: this._id(), name: String(name || '').trim(), query: query || '', tags: normTags(tags) };
    if (!c.name) return { error: 'name-required' };
    this.data.collections.push(c);
    this._save();
    return { collection: c };
  }
  removeCollection(id) {
    const i = this.data.collections.findIndex(c => c.id === id);
    if (i < 0) return { error: 'not-found' };
    this.data.collections.splice(i, 1);
    this._save();
    return { ok: true };
  }
}

function normTags(tags) {
  if (!Array.isArray(tags)) return [];
  const seen = new Set(); const out = [];
  for (const t of tags) { const v = String(t || '').trim().toLowerCase(); if (v && !seen.has(v)) { seen.add(v); out.push(v); } }
  return out;
}

module.exports = { Store, fallbackFavicon, DEFAULT_SETTINGS };
