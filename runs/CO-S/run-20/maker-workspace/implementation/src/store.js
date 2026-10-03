// File-backed store for the personal bookmark collection.
// Single-user, personal scale (SCN goal): a JSON file is a reliable, simple
// persistence choice that survives between sessions. All mutations are written
// through immediately.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';
import { sameUrl } from '../public/shared/filters.js';
import { hostOf } from './metadata.js';

export class BookmarkStore {
  constructor(filePath) {
    this.filePath = filePath;
    this.items = [];
    this._nextId = 1;
    this._load();
  }

  _load() {
    try {
      if (existsSync(this.filePath)) {
        const raw = JSON.parse(readFileSync(this.filePath, 'utf8'));
        if (Array.isArray(raw)) this.items = raw;
      }
    } catch {
      this.items = [];
    }
    this._nextId = this.items.reduce((max, it) => Math.max(max, Number(it.id) || 0), 0) + 1;
  }

  _persist() {
    mkdirSync(dirname(this.filePath), { recursive: true });
    writeFileSync(this.filePath, JSON.stringify(this.items, null, 2));
  }

  list() {
    return this.items.slice();
  }

  clear() {
    this.items = [];
    this._nextId = 1;
    this._persist();
  }

  get(id) {
    return this.items.find((it) => it.id === id) || null;
  }

  findByUrl(url) {
    return this.items.find((it) => sameUrl(it.url, url)) || null;
  }

  /**
   * Create a bookmark. Enforces no-duplicates (SCN-009): if the address already
   * exists (collection OR archive) returns { duplicate: true, item: existing }
   * without adding a copy. New links start unread (SCN-004).
   */
  create({ url, title, description = '', note = '', topics = [], favicon = '' }) {
    const address = String(url || '').trim();
    if (!address) throw new ValidationError('An address is required.');

    const existing = this.findByUrl(address);
    if (existing) return { duplicate: true, item: existing };

    const item = {
      id: this._nextId++,
      url: address,
      title: (title && title.trim()) || hostOf(address) || address,
      description: String(description || '').trim(),
      note: String(note || '').trim(),
      topics: normalizeTopics(topics),
      host: hostOf(address),
      favicon: String(favicon || '').trim(),
      unread: true,
      archived: false,
      created: Date.now(),
    };
    this.items.push(item);
    this._persist();
    return { duplicate: false, item };
  }

  /**
   * Update an existing bookmark's editable fields (SCN-008). Preserves created,
   * unread and archived state. Rejects an address already used by another link
   * (SCN-009) via { conflict: true }.
   */
  update(id, { url, title, description, note, topics, favicon }) {
    const item = this.get(id);
    if (!item) return null;

    if (url !== undefined) {
      const address = String(url).trim();
      if (!address) throw new ValidationError('An address is required.');
      const clash = this.items.find((it) => it.id !== id && sameUrl(it.url, address));
      if (clash) return { conflict: true, item: clash };
      item.url = address;
      item.host = hostOf(address);
    }
    if (title !== undefined) item.title = (title && title.trim()) || item.host || item.url;
    if (description !== undefined) item.description = String(description || '').trim();
    if (note !== undefined) item.note = String(note || '').trim();
    if (topics !== undefined) item.topics = normalizeTopics(topics);
    if (favicon !== undefined) item.favicon = String(favicon || '').trim();

    this._persist();
    return { item };
  }

  remove(id) {
    const before = this.items.length;
    this.items = this.items.filter((it) => it.id !== id);
    const removed = this.items.length !== before;
    if (removed) this._persist();
    return removed;
  }

  setArchived(id, archived) {
    const item = this.get(id);
    if (!item) return null;
    item.archived = !!archived;
    this._persist();
    return item;
  }

  setUnread(id, unread) {
    const item = this.get(id);
    if (!item) return null;
    item.unread = !!unread;
    this._persist();
    return item;
  }
}

export class ValidationError extends Error {}

function normalizeTopics(topics) {
  if (!Array.isArray(topics)) return [];
  const seen = new Set();
  const out = [];
  for (const raw of topics) {
    const t = String(raw || '').trim();
    if (t && !seen.has(t.toLowerCase())) {
      seen.add(t.toLowerCase());
      out.push(t);
    }
  }
  return out;
}
