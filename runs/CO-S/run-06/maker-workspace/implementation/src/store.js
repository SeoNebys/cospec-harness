// Data layer for bookmarks.
// Single-user, file-backed JSON persistence. No external DB dependency.
// Implements the query/filtering behaviour required by the approved scenarios
// (SCN-002 search + tag filter, SCN-003 read-later view, SCN-004 archive view).

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

// Normalise a URL for duplicate comparison (SCN-007):
// ignore case and trailing slashes.
export function normalizeUrl(url) {
  return String(url).trim().replace(/\/+$/, "").toLowerCase();
}

// Judge whether a string is a usable web link (SCN-006 "refuse invalid").
// Accepts http/https; if no scheme is given, assumes https. Returns the
// canonical href string, or null when it is not a valid link.
export function coerceUrl(raw) {
  const s = String(raw || "").trim();
  if (!s) return null;
  let candidate = s;
  if (!/^https?:\/\//i.test(candidate)) {
    if (/\s/.test(candidate)) return null; // "not a url" -> reject
    candidate = "https://" + candidate;
  }
  let u;
  try {
    u = new URL(candidate);
  } catch {
    return null;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;
  if (!u.hostname || !u.hostname.includes(".")) return null;
  return u.href;
}

export class Store {
  constructor(filePath) {
    this.filePath = filePath;
    this.items = [];
    this.seq = 1;
    this._load();
  }

  _load() {
    if (this.filePath && existsSync(this.filePath)) {
      try {
        const data = JSON.parse(readFileSync(this.filePath, "utf8"));
        this.items = Array.isArray(data.items) ? data.items : [];
        this.seq = data.seq || this._maxId() + 1;
      } catch {
        this.items = [];
        this.seq = 1;
      }
    }
  }

  _maxId() {
    return this.items.reduce((m, it) => Math.max(m, it.id), 0);
  }

  _persist() {
    if (!this.filePath) return;
    mkdirSync(dirname(this.filePath), { recursive: true });
    writeFileSync(
      this.filePath,
      JSON.stringify({ seq: this.seq, items: this.items }, null, 2)
    );
  }

  findByUrl(url) {
    const key = normalizeUrl(url);
    return this.items.find((it) => normalizeUrl(it.url) === key) || null;
  }

  get(id) {
    return this.items.find((it) => it.id === Number(id)) || null;
  }

  // Create a new bookmark. New items start not-later and not-archived (SCN-003/4).
  create({ url, title, note, tags }) {
    const item = {
      id: this.seq++,
      url,
      title: title && title.trim() ? title.trim() : url, // fall back to URL (SCN-006)
      note: (note || "").trim(),
      tags: cleanTags(tags),
      later: false,
      archived: false,
      createdAt: Date.now(),
    };
    this.items.unshift(item); // newest first (SCN-001)
    this._persist();
    return item;
  }

  // Update title/note/tags in place, preserving identity and later/archived
  // state (SCN-007 edit).
  update(id, { title, note, tags }) {
    const it = this.get(id);
    if (!it) return null;
    if (title !== undefined) it.title = title && title.trim() ? title.trim() : it.url;
    if (note !== undefined) it.note = (note || "").trim();
    if (tags !== undefined) it.tags = cleanTags(tags);
    this._persist();
    return it;
  }

  setLater(id, later) {
    const it = this.get(id);
    if (!it) return null;
    it.later = !!later;
    this._persist();
    return it;
  }

  setArchived(id, archived) {
    const it = this.get(id);
    if (!it) return null;
    it.archived = !!archived;
    this._persist();
    return it;
  }

  // Which items belong to a view (SCN-003, SCN-004).
  _inView(it, view) {
    if (view === "archive") return it.archived;
    if (view === "later") return it.later && !it.archived;
    return !it.archived; // all
  }

  // Tags available within a view (for the filter chips).
  tagsForView(view) {
    const set = new Set();
    for (const it of this.items) {
      if (this._inView(it, view)) it.tags.forEach((t) => set.add(t));
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }

  // List with search + tag filter (SCN-002). Search is case-insensitive and
  // matches across title, note, url and tags together.
  list({ view = "all", q = "", tag = "" } = {}) {
    const query = String(q || "").trim().toLowerCase();
    const tagFilter = String(tag || "").trim();
    return this.items.filter((it) => {
      if (!this._inView(it, view)) return false;
      if (tagFilter && !it.tags.includes(tagFilter)) return false;
      if (!query) return true;
      const hay = [it.title, it.note, it.url, it.tags.join(" ")]
        .join(" ")
        .toLowerCase();
      return hay.includes(query);
    });
  }
}

function cleanTags(tags) {
  if (!Array.isArray(tags)) return [];
  const seen = new Set();
  const out = [];
  for (const raw of tags) {
    const t = String(raw || "").trim().replace(/^#/, "");
    if (t && !seen.has(t.toLowerCase())) {
      seen.add(t.toLowerCase());
      out.push(t);
    }
  }
  return out;
}
