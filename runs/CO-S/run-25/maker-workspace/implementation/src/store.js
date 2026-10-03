"use strict";
// Persistent store for bookmarks and their preserved copies.
// Data is a single JSON file; preserved copies are files under <dataDir>/copies.

const fs = require("fs");
const path = require("path");

function nowIso() { return new Date().toISOString(); }

class Store {
  constructor(dataDir) {
    this.dataDir = dataDir;
    this.copiesDir = path.join(dataDir, "copies");
    this.file = path.join(dataDir, "bookmarks.json");
    fs.mkdirSync(this.copiesDir, { recursive: true });
    this._load();
  }

  _load() {
    try {
      const raw = fs.readFileSync(this.file, "utf8");
      const data = JSON.parse(raw);
      this.items = Array.isArray(data.items) ? data.items : [];
      this.seq = typeof data.seq === "number" ? data.seq : this.items.length;
    } catch (e) {
      this.items = [];
      this.seq = 0;
    }
  }

  _save() {
    const tmp = this.file + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify({ seq: this.seq, items: this.items }, null, 2));
    fs.renameSync(tmp, this.file);
  }

  all() { return this.items.slice(); }

  get(id) { return this.items.find((it) => it.id === id) || null; }

  nextOrder() {
    return this.items.reduce((m, x) => Math.max(m, x.order || 0), 0) + 1;
  }

  create(fields) {
    const id = ++this.seq;
    const item = Object.assign(
      {
        id,
        url: "",
        host: "",
        title: "",
        desc: "",
        tags: [],
        note: "",
        toRead: false,
        archived: false,
        savedAt: nowIso(),
        capturedAt: null,
        copy: { status: "pending", kind: null }, // status: pending | ok | unavailable
        order: this.nextOrder(),
      },
      fields
    );
    item.id = id;
    this.items.push(item);
    this._save();
    return item;
  }

  update(id, patch) {
    const it = this.get(id);
    if (!it) return null;
    Object.assign(it, patch);
    this._save();
    return it;
  }

  remove(id) {
    const i = this.items.findIndex((it) => it.id === id);
    if (i < 0) return false;
    this.items.splice(i, 1);
    this._removeCopyFiles(id);
    this._save();
    return true;
  }

  copyPath(id, kind) {
    return path.join(this.copiesDir, id + (kind === "pdf" ? ".pdf" : ".html"));
  }

  _removeCopyFiles(id) {
    for (const ext of [".html", ".pdf"]) {
      const p = path.join(this.copiesDir, id + ext);
      try { fs.unlinkSync(p); } catch (e) { /* ignore */ }
    }
  }

  // Write a preserved copy to disk and update the item's copy metadata.
  saveCopy(id, kind, buffer) {
    this._removeCopyFiles(id);
    const p = this.copyPath(id, kind);
    fs.writeFileSync(p, buffer);
    return p;
  }

  readCopy(id, kind) {
    return fs.readFileSync(this.copyPath(id, kind));
  }
}

module.exports = { Store, nowIso };
