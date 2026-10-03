// Durable storage for bookmarks (SCN-011: persist between visits).
// Bookmarks are kept in a JSON file; kept-copy snapshots are stored as separate
// HTML files. This module owns all data rules (create/edit/remove, duplicate
// rejection); the HTTP layer and network fetching live in server.js.

import fs from 'node:fs';
import path from 'node:path';
import { normalizeUrl, isValidUrl, sameUrl, normalizeTags } from './validate.js';

export class Store {
  constructor(dataDir) {
    this.dataDir = dataDir;
    this.dbFile = path.join(dataDir, 'bookmarks.json');
    this.snapDir = path.join(dataDir, 'snapshots');
    fs.mkdirSync(this.snapDir, { recursive: true });
    this._load();
  }

  _load() {
    try {
      const raw = fs.readFileSync(this.dbFile, 'utf8');
      const parsed = JSON.parse(raw);
      this.items = Array.isArray(parsed.items) ? parsed.items : [];
      this.nextId = parsed.nextId || this._maxId() + 1;
    } catch {
      this.items = [];
      this.nextId = 1;
    }
  }

  _maxId() {
    return this.items.reduce((m, it) => Math.max(m, it.id || 0), 0);
  }

  _save() {
    const tmp = this.dbFile + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify({ items: this.items, nextId: this.nextId }, null, 2));
    fs.renameSync(tmp, this.dbFile); // atomic replace
  }

  // Newest first (SCN-001).
  list() {
    return this.items.slice().sort((a, b) => b.createdAt - a.createdAt || b.id - a.id);
  }

  get(id) {
    return this.items.find(it => it.id === Number(id)) || null;
  }

  findByUrl(url, exceptId = null) {
    return this.items.find(it => sameUrl(it.url, url) && it.id !== Number(exceptId)) || null;
  }

  // data: { url, title, note, tags, toread, keepcopy }
  // Returns { bookmark } or { error, existing }.
  create(data) {
    const url = normalizeUrl(data.url);
    if (!url) return { error: 'empty' };
    if (!isValidUrl(url)) return { error: 'invalid' };
    const existing = this.findByUrl(url);
    if (existing) return { error: 'duplicate', existing }; // SCN-007

    const bm = {
      id: this.nextId++,
      url,
      title: (data.title || '').trim(),
      note: (data.note || '').trim(),
      tags: normalizeTags(data.tags),
      toread: data.toread !== false,          // SCN-004: default to "to read"
      keepcopy: !!data.keepcopy,              // SCN-005: opt-in
      savedOn: data.keepcopy ? new Date().toISOString() : null,
      createdAt: Date.now(),
    };
    this.items.push(bm);
    this._save();
    return { bookmark: bm };
  }

  // Partial update. Validates address changes the same way as create (SCN-006).
  update(id, data) {
    const bm = this.get(id);
    if (!bm) return { error: 'notfound' };

    if (data.url !== undefined) {
      const url = normalizeUrl(data.url);
      if (!isValidUrl(url)) return { error: 'invalid' };
      const clash = this.findByUrl(url, bm.id);
      if (clash) return { error: 'duplicate', existing: clash };
      bm.url = url;
    }
    if (data.title !== undefined) bm.title = (data.title || '').trim();
    if (data.note !== undefined) bm.note = (data.note || '').trim();
    if (data.tags !== undefined) bm.tags = normalizeTags(data.tags);
    if (data.toread !== undefined) bm.toread = !!data.toread;
    if (data.keepcopy !== undefined) {
      bm.keepcopy = !!data.keepcopy;
      if (bm.keepcopy && !bm.savedOn) bm.savedOn = new Date().toISOString();
    }
    this._save();
    return { bookmark: bm };
  }

  remove(id) {
    const i = this.items.findIndex(it => it.id === Number(id));
    if (i === -1) return { error: 'notfound' };
    this.items.splice(i, 1);
    this._save();
    this._deleteSnapshot(id);
    return { ok: true };
  }

  // Snapshot storage (SCN-005). Content is the readable page text captured at save.
  setSnapshot(id, content) {
    fs.writeFileSync(path.join(this.snapDir, `${id}.html`), content, 'utf8');
  }

  getSnapshot(id) {
    try {
      return fs.readFileSync(path.join(this.snapDir, `${id}.html`), 'utf8');
    } catch {
      return null;
    }
  }

  _deleteSnapshot(id) {
    try { fs.unlinkSync(path.join(this.snapDir, `${id}.html`)); } catch { /* none */ }
  }
}
