// Persistence + domain rules for bookmarks.
// Implements: normalisation, validity check, duplicate detection, CRUD, and
// durable storage. Title retrieval lives in title.js; this module treats a
// resolved title as plain input (SCN-001, SCN-009).
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';

/** Add an https:// scheme when the user omitted one (SCN-008). */
export function normalizeUrl(raw) {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return '';
  return /^https?:\/\//i.test(trimmed) ? trimmed : 'https://' + trimmed;
}

/** Lightweight validity: a parseable host containing a dot, no whitespace (SCN-008). */
export function looksLikeUrl(url) {
  try {
    const u = new URL(url);
    return (u.protocol === 'http:' || u.protocol === 'https:') &&
      u.hostname.includes('.') && !/\s/.test(u.hostname);
  } catch {
    return false;
  }
}

/**
 * Canonical form for duplicate comparison: host without "www.", path without a
 * trailing slash, plus query; case-insensitive; fragment ignored (SCN-008).
 */
export function canonical(url) {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./i, '');
    const path = u.pathname.replace(/\/+$/, '');
    return (host + path + u.search).toLowerCase();
  } catch {
    return String(url || '').toLowerCase();
  }
}

/** Normalise a list of tags: trim, lower-case, drop empties, de-duplicate (SCN-003). */
export function normalizeTags(tags) {
  const out = [];
  const seen = new Set();
  for (const t of Array.isArray(tags) ? tags : []) {
    const tag = String(t).trim().toLowerCase();
    if (tag && !seen.has(tag)) { seen.add(tag); out.push(tag); }
  }
  return out;
}

export class Store {
  constructor(dataFile) {
    this.dataFile = dataFile;
    this.items = this._load();
  }

  _load() {
    try {
      if (existsSync(this.dataFile)) {
        const parsed = JSON.parse(readFileSync(this.dataFile, 'utf8'));
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // Corrupt/unreadable file: start empty rather than crash.
    }
    return [];
  }

  _save() {
    mkdirSync(dirname(this.dataFile), { recursive: true });
    writeFileSync(this.dataFile, JSON.stringify(this.items, null, 2));
  }

  /** All bookmarks, newest first (SCN-001). */
  all() {
    return this.items.slice();
  }

  get(id) {
    return this.items.find((b) => b.id === id) || null;
  }

  /** Find an existing bookmark whose URL matches (canonical) the given URL (SCN-008). */
  findDuplicate(url) {
    const c = canonical(url);
    return this.items.find((b) => canonical(b.url) === c) || null;
  }

  /**
   * Create a bookmark. Caller has already normalised/validated the URL and
   * resolved a title. Returns the created record. Newest goes to the top.
   */
  add({ url, title, tags }) {
    const bookmark = {
      id: randomUUID(),
      url,
      title: title && String(title).trim() ? String(title).trim() : url,
      tags: normalizeTags(tags),
      toRead: false,
      archived: false,
      createdAt: new Date().toISOString(),
    };
    this.items.unshift(bookmark);
    this._save();
    return bookmark;
  }

  /**
   * Update editable fields. title (empty keeps previous — SCN-002), tags,
   * toRead (SCN-005), archived (SCN-006). Returns updated record or null.
   */
  update(id, patch = {}) {
    const b = this.get(id);
    if (!b) return null;
    if (patch.title !== undefined) {
      const t = String(patch.title).trim();
      if (t) b.title = t; // empty title is ignored, previous kept
    }
    if (patch.tags !== undefined) b.tags = normalizeTags(patch.tags);
    if (patch.toRead !== undefined) b.toRead = !!patch.toRead;
    if (patch.archived !== undefined) b.archived = !!patch.archived;
    this._save();
    return b;
  }

  /** Permanently remove a bookmark (SCN-007). Returns true if it existed. */
  remove(id) {
    const i = this.items.findIndex((b) => b.id === id);
    if (i < 0) return false;
    this.items.splice(i, 1);
    this._save();
    return true;
  }
}
