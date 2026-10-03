// Data layer: a persisted list of bookmarks with the approved domain rules.
// Persistence is a JSON file written atomically. Single-user, local.
'use strict';

const fs = require('fs');
const path = require('path');
const { normalizeUrl, canonicalKey } = require('../public/lib/canonical.js');
const { faviconFor } = require('./metadata.js');

const STATE_ACTIONS = ['read', 'unread', 'archive', 'restore'];

function hostOf(url) {
  return new URL(url).hostname.replace(/^www\./, '');
}
function normTag(t) {
  return String(t == null ? '' : t).trim().replace(/\s+/g, ' ').slice(0, 40);
}

class Store {
  constructor(file) {
    this.file = file;
    this.bookmarks = [];
    this.nextId = 1;
    this._load();
  }

  _load() {
    try {
      const raw = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      this.bookmarks = Array.isArray(raw.bookmarks) ? raw.bookmarks : [];
      const maxId = this.bookmarks.reduce((m, b) => Math.max(m, b.id || 0), 0);
      this.nextId = raw.nextId && raw.nextId > maxId ? raw.nextId : maxId + 1;
    } catch (e) {
      this.bookmarks = [];
      this.nextId = 1;
    }
  }

  _save() {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const tmp = this.file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify({ bookmarks: this.bookmarks, nextId: this.nextId }, null, 2));
    fs.renameSync(tmp, this.file);
  }

  all() { return this.bookmarks; }
  byId(id) { return this.bookmarks.find((b) => b.id === id); }
  byKey(key) { return this.bookmarks.find((b) => b.key === key); }

  // Look up an existing entry for an address without creating anything (SCN-002/007).
  findExisting(url) {
    const norm = normalizeUrl(url);
    if (!norm) return { error: 'invalid_url' };
    const existing = this.byKey(canonicalKey(norm));
    return { url: norm, existing: existing || null };
  }

  // Create from reviewed details (SCN-007). Guards duplicates (SCN-002).
  create(input) {
    const norm = normalizeUrl(input.url);
    if (!norm) return { error: 'invalid_url' };
    const key = canonicalKey(norm);
    const dup = this.byKey(key);
    if (dup) return { duplicate: true, bookmark: dup };
    const host = hostOf(norm);
    const title = (typeof input.title === 'string' && input.title.trim()) ? input.title.trim() : host;
    const entry = {
      id: this.nextId++,
      url: norm,
      key: key,
      title: title,
      description: typeof input.description === 'string' ? input.description.trim() : '',
      siteName: host,
      favicon: faviconFor(host),
      image: typeof input.image === 'string' ? input.image : '',
      retrieved: input.retrieved !== false,
      read: false,
      archived: false,
      tags: [],
      note: typeof input.note === 'string' ? input.note.trim() : '',
      savedAt: new Date().toISOString(),
    };
    this.bookmarks.unshift(entry);
    this._save();
    return { duplicate: false, bookmark: entry };
  }

  // Edit title/description/note and optionally the address (SCN-006).
  update(id, input) {
    const b = this.byId(id);
    if (!b) return { error: 'not_found' };
    if (typeof input.url === 'string' && input.url.trim()) {
      const norm = normalizeUrl(input.url);
      if (!norm) return { error: 'invalid_url' };
      const nk = canonicalKey(norm);
      const clash = this.bookmarks.find((x) => x.id !== id && x.key === nk);
      if (clash) return { error: 'duplicate_address', title: clash.title };
      if (nk !== b.key) {
        b.url = norm; b.key = nk;
        const host = hostOf(norm);
        b.siteName = host; b.favicon = faviconFor(host);
      }
    }
    if (typeof input.title === 'string') {
      const t = input.title.trim();
      b.title = t || hostOf(b.url);
    }
    if (typeof input.description === 'string') b.description = input.description.trim();
    if (typeof input.note === 'string') b.note = input.note.trim();
    this._save();
    return { bookmark: b };
  }

  setState(id, changes) {
    const b = this.byId(id);
    if (!b) return { error: 'not_found' };
    if (typeof changes.read === 'boolean') b.read = changes.read;
    if (typeof changes.archived === 'boolean') b.archived = changes.archived;
    this._save();
    return { bookmark: b };
  }

  addTag(id, tag) {
    const b = this.byId(id);
    if (!b) return { error: 'not_found' };
    const t = normTag(tag);
    if (!t) return { error: 'empty_tag' };
    if (!b.tags.some((x) => x.toLowerCase() === t.toLowerCase())) b.tags.push(t);
    this._save();
    return { bookmark: b };
  }

  removeTag(id, tag) {
    const b = this.byId(id);
    if (!b) return { error: 'not_found' };
    const t = normTag(tag);
    b.tags = b.tags.filter((x) => x.toLowerCase() !== t.toLowerCase());
    this._save();
    return { bookmark: b };
  }

  remove(id) {
    const idx = this.bookmarks.findIndex((b) => b.id === id);
    if (idx < 0) return { error: 'not_found' };
    this.bookmarks.splice(idx, 1);
    this._save();
    return { ok: true };
  }

  // Apply one action to many links (SCN-015).
  bulk(ids, action, value) {
    if (!Array.isArray(ids)) return { error: 'bad_ids' };
    const idset = new Set(ids);
    if (action === 'delete') {
      const before = this.bookmarks.length;
      this.bookmarks = this.bookmarks.filter((b) => !idset.has(b.id));
      this._save();
      return { ok: true, count: before - this.bookmarks.length };
    }
    const targets = this.bookmarks.filter((b) => idset.has(b.id));
    const t = normTag(value);
    for (const b of targets) {
      if (action === 'read') b.read = true;
      else if (action === 'unread') b.read = false;
      else if (action === 'archive') b.archived = true;
      else if (action === 'restore') b.archived = false;
      else if (action === 'addtag') { if (t && !b.tags.some((x) => x.toLowerCase() === t.toLowerCase())) b.tags.push(t); }
      else if (action === 'removetag') { if (t) b.tags = b.tags.filter((x) => x.toLowerCase() !== t.toLowerCase()); }
      else return { error: 'bad_action' };
    }
    this._save();
    return { ok: true, count: targets.length };
  }
}

module.exports = { Store: Store, STATE_ACTIONS: STATE_ACTIONS };
