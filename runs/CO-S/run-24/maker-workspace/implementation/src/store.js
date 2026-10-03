// Simple durable storage for the single personal user: a JSON file on disk.
// No database is prescribed; this keeps the collection persistent across restarts
// while staying dependency-free.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";

export class Store {
  constructor(filePath) {
    this.filePath = filePath;
    this.links = [];
    this._loaded = false;
    this._writing = Promise.resolve();
  }

  async load() {
    try {
      const raw = await readFile(this.filePath, "utf8");
      const data = JSON.parse(raw);
      this.links = Array.isArray(data.links) ? data.links : [];
    } catch (e) {
      this.links = [];
    }
    this._loaded = true;
    return this.links;
  }

  async _persist() {
    await mkdir(dirname(this.filePath), { recursive: true });
    const body = JSON.stringify({ links: this.links }, null, 2);
    // serialise writes to avoid interleaving
    this._writing = this._writing.then(() => writeFile(this.filePath, body, "utf8"));
    return this._writing;
  }

  all() {
    return this.links;
  }

  get(id) {
    return this.links.find((l) => l.id === id) || null;
  }

  async add(link) {
    this.links.push(link);
    await this._persist();
    return link;
  }

  async update(id, patch) {
    const link = this.get(id);
    if (!link) return null;
    Object.assign(link, patch);
    await this._persist();
    return link;
  }

  async remove(id) {
    const before = this.links.length;
    this.links = this.links.filter((l) => l.id !== id);
    const removed = this.links.length < before;
    if (removed) await this._persist();
    return removed;
  }
}
