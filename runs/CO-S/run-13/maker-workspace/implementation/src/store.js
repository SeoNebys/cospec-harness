// Durable, single-user bookmark store (JSON file with atomic writes).
// Central goal: nothing gets lost. All mutations persist immediately.

import { readFileSync, writeFileSync, renameSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeUrl, urlKey, InvalidUrlError } from "./url.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_FILE = join(__dirname, "..", "data", "bookmarks.json");

export class DuplicateError extends Error {
  constructor(existing) {
    super("A bookmark with this address already exists.");
    this.code = "duplicate";
    this.existing = existing;
  }
}
export class NotFoundError extends Error {
  constructor() {
    super("Bookmark not found.");
    this.code = "not_found";
  }
}

export class Store {
  constructor(file = process.env.BOOKMARKS_DATA || DEFAULT_FILE) {
    this.file = file;
    this.items = [];
    this.nextId = 1;
    this._load();
  }

  _load() {
    try {
      const raw = readFileSync(this.file, "utf8");
      const data = JSON.parse(raw);
      this.items = Array.isArray(data.items) ? data.items : [];
      this.nextId = Number.isInteger(data.nextId) ? data.nextId : this._computeNextId();
    } catch {
      this.items = [];
      this.nextId = 1;
    }
  }

  _computeNextId() {
    return this.items.reduce((m, b) => Math.max(m, b.id || 0), 0) + 1;
  }

  _save() {
    mkdirSync(dirname(this.file), { recursive: true });
    const tmp = this.file + ".tmp";
    writeFileSync(tmp, JSON.stringify({ nextId: this.nextId, items: this.items }, null, 2));
    renameSync(tmp, this.file); // atomic replace
  }

  // Test-only: clear all data. Guarded by the caller (never exposed in prod).
  reset() {
    this.items = [];
    this.nextId = 1;
    this._save();
  }

  list() {
    return this.items.map((b) => ({ ...b }));
  }

  get(id) {
    return this.items.find((b) => b.id === Number(id)) || null;
  }

  findByUrl(url, exceptId = null) {
    const key = urlKey(url);
    return this.items.find((b) => urlKey(b.url) === key && b.id !== exceptId) || null;
  }

  // fields: { url, title, description?, tags?, note?, image?, icon?, site? }
  create(fields) {
    const { url, host } = normalizeUrl(fields.url); // throws InvalidUrlError
    const dup = this.findByUrl(url);
    if (dup) throw new DuplicateError({ ...dup });
    const bm = {
      id: this.nextId++,
      url,
      host,
      site: fields.site || host,
      title: (fields.title || "").trim() || host,
      description: (fields.description || "").trim(),
      tags: normalizeTags(fields.tags),
      note: (fields.note || "").trim(),
      image: fields.image || null,
      icon: fields.icon || null,
      savedAt: Date.now(),
      readLater: false,
      archived: false,
    };
    this.items.unshift(bm);
    this._save();
    return { ...bm };
  }

  // Partial update. Editable: url, title, description, tags, note, readLater, archived.
  update(id, changes) {
    const bm = this.items.find((b) => b.id === Number(id));
    if (!bm) throw new NotFoundError();

    if (changes.url !== undefined) {
      const { url, host } = normalizeUrl(changes.url); // throws InvalidUrlError
      const clash = this.findByUrl(url, bm.id);
      if (clash) throw new DuplicateError({ ...clash });
      if (urlKey(url) !== urlKey(bm.url)) {
        // Site details follow the new address (SCN-008).
        bm.url = url;
        bm.host = host;
        bm.site = host;
        bm.image = null;
        bm.icon = null;
      } else {
        bm.url = url;
      }
    }
    if (changes.title !== undefined) bm.title = (changes.title || "").trim() || bm.title;
    if (changes.description !== undefined) bm.description = (changes.description || "").trim();
    if (changes.tags !== undefined) bm.tags = normalizeTags(changes.tags);
    if (changes.note !== undefined) bm.note = (changes.note || "").trim();
    if (changes.readLater !== undefined) bm.readLater = !!changes.readLater;
    if (changes.archived !== undefined) bm.archived = !!changes.archived;

    this._save();
    return { ...bm };
  }
}

function normalizeTags(tags) {
  let arr = [];
  if (Array.isArray(tags)) arr = tags;
  else if (typeof tags === "string") arr = tags.split(",");
  const seen = new Set();
  const out = [];
  for (const t of arr) {
    const v = String(t).trim();
    if (!v) continue;
    const k = v.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(v);
  }
  return out;
}

export { InvalidUrlError };
