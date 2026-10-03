// Persistent store for bookmarks — a JSON file with atomic writes.
// The collection is personal and single-user, and must survive restarts (NF-1).

import { readFile, writeFile, rename, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_FILE = join(__dirname, "..", "data", "bookmarks.json");

export class BookmarkStore {
  constructor(file = DEFAULT_FILE) {
    this.file = file;
    this.bookmarks = [];
    this._writeChain = Promise.resolve();
  }

  async load() {
    await mkdir(dirname(this.file), { recursive: true });
    if (!existsSync(this.file)) {
      this.bookmarks = [];
      return;
    }
    try {
      const raw = await readFile(this.file, "utf8");
      const parsed = JSON.parse(raw);
      this.bookmarks = Array.isArray(parsed) ? parsed : [];
    } catch {
      this.bookmarks = [];
    }
  }

  // Serialise writes and write atomically (temp file + rename).
  _persist() {
    this._writeChain = this._writeChain.then(async () => {
      const tmp = this.file + ".tmp";
      await writeFile(tmp, JSON.stringify(this.bookmarks, null, 2), "utf8");
      await rename(tmp, this.file);
    });
    return this._writeChain;
  }

  all() {
    return this.bookmarks;
  }

  findById(id) {
    return this.bookmarks.find((b) => b.id === id) || null;
  }

  findByUrl(url) {
    const target = (url || "").trim();
    return this.bookmarks.find((b) => b.url === target) || null;
  }

  async add(bookmark) {
    this.bookmarks.unshift(bookmark); // newest first (SCN-001)
    await this._persist();
    return bookmark;
  }

  async update(id, patch) {
    const bm = this.findById(id);
    if (!bm) return null;
    Object.assign(bm, patch);
    await this._persist();
    return bm;
  }

  async remove(id) {
    const i = this.bookmarks.findIndex((b) => b.id === id);
    if (i === -1) return false;
    this.bookmarks.splice(i, 1);
    await this._persist();
    return true;
  }
}
