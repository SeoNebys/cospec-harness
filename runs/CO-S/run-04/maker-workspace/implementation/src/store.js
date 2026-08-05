'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { sameLink } = require('./links');

// SCN-009: durable storage. Bookmarks are held in memory for fast reads and
// mirrored to a JSON file on every change, so nothing is lost when the process
// stops and everything is present again on restart.
//
// Order in the array IS the display order (newest first). New links go to the
// front; restore re-inserts at an explicit index.
class Store {
  constructor(filePath) {
    this.filePath = filePath;
    this.items = this._load();
  }

  _load() {
    try {
      const raw = fs.readFileSync(this.filePath, 'utf8');
      const data = JSON.parse(raw);
      return Array.isArray(data) ? data : [];
    } catch (e) {
      if (e.code === 'ENOENT') return []; // first run, no file yet
      // Corrupt file: do NOT wipe it — surface the problem instead of losing data.
      throw new Error('Could not read bookmarks store at ' + this.filePath + ': ' + e.message);
    }
  }

  _persist() {
    const dir = path.dirname(this.filePath);
    fs.mkdirSync(dir, { recursive: true });
    const tmp = this.filePath + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(this.items, null, 2));
    fs.renameSync(tmp, this.filePath); // atomic replace so a crash can't truncate the file
  }

  list() {
    return this.items.map((it) => ({ ...it }));
  }

  get(id) {
    const it = this.items.find((x) => x.id === id);
    return it ? { ...it } : null;
  }

  // SCN-008: find an existing link with the same normalised URL.
  findByUrl(url) {
    const it = this.items.find((x) => sameLink(x.url, url));
    return it ? { ...it } : null;
  }

  // SCN-001/006: add a new link at the top (newest first).
  add({ url, title, nameStatus }) {
    const record = {
      id: crypto.randomUUID(),
      url: String(url).trim(),
      title: title,
      nameStatus: nameStatus, // 'found' | 'fallback' | 'custom'
      createdAt: new Date().toISOString(),
    };
    this.items.unshift(record);
    this._persist();
    return { ...record };
  }

  // SCN-002: rename. Renaming makes the name 'custom' (clears the "not found" nudge).
  rename(id, title) {
    const it = this.items.find((x) => x.id === id);
    if (!it) return null;
    it.title = title;
    it.nameStatus = 'custom';
    this._persist();
    return { ...it };
  }

  // SCN-004: remove, returning the record and its position so it can be undone.
  remove(id) {
    const index = this.items.findIndex((x) => x.id === id);
    if (index === -1) return null;
    const [record] = this.items.splice(index, 1);
    this._persist();
    return { record: { ...record }, index };
  }

  // SCN-004: undo a removal by re-inserting the exact record at its old spot.
  restore(record, index) {
    if (!record || !record.id) return null;
    if (this.items.some((x) => x.id === record.id)) return this.get(record.id);
    const at = Math.max(0, Math.min(Number(index) || 0, this.items.length));
    this.items.splice(at, 0, { ...record });
    this._persist();
    return { ...record };
  }
}

module.exports = { Store };
