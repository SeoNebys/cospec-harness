// Persistence layer. Bookmarks are stored as JSON on disk with atomic writes.
//
// Design decision: a JSON file store (rather than SQLite) keeps the dependency
// footprint pure-JS with no native build step or experimental flags, which is
// more than adequate for a single-user personal bookmark manager. The access is
// funnelled through this module so the storage engine can be swapped later
// without touching callers. See DESIGN-DECISIONS.md (DD-2).

import { readFileSync, writeFileSync, renameSync, mkdirSync, existsSync } from "node:fs";
import { dirname } from "node:path";

export class Store {
  constructor(file) {
    this.file = file;
    mkdirSync(dirname(file), { recursive: true });
    if (!existsSync(file)) this._writeAll([]);
  }

  _readAll() {
    try {
      return JSON.parse(readFileSync(this.file, "utf8")) || [];
    } catch {
      return [];
    }
  }

  _writeAll(items) {
    const tmp = this.file + ".tmp";
    writeFileSync(tmp, JSON.stringify(items, null, 2));
    renameSync(tmp, this.file); // atomic replace
  }

  // Newest first (SCN-001). Ties (same-millisecond saves) are broken by the
  // monotonic id so ordering is always deterministic.
  list() {
    return this._readAll().sort((a, b) => b.savedAt - a.savedAt || b.id - a.id);
  }

  findByKey(key) {
    return this._readAll().find((b) => b.urlKey === key) || null;
  }

  get(id) {
    return this._readAll().find((b) => b.id === id) || null;
  }

  insert(bookmark) {
    const items = this._readAll();
    items.push(bookmark);
    this._writeAll(items);
    return bookmark;
  }

  update(id, patch) {
    const items = this._readAll();
    const i = items.findIndex((b) => b.id === id);
    if (i === -1) return null;
    items[i] = { ...items[i], ...patch };
    this._writeAll(items);
    return items[i];
  }

  remove(id) {
    const items = this._readAll();
    const next = items.filter((b) => b.id !== id);
    if (next.length === items.length) return false;
    this._writeAll(next);
    return true;
  }
}
