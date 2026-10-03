'use strict';
// Persistent store backed by a single JSON file. Single-user app, so simple
// synchronous file writes are sufficient and keep persistence robust across
// sessions (SCN-018 persistence, general data durability).
const fs = require('fs');
const path = require('path');

class Store {
  constructor(dataDir) {
    this.dataDir = dataDir;
    this.dbPath = path.join(dataDir, 'db.json');
    this.snapDir = path.join(dataDir, 'snapshots');
    fs.mkdirSync(this.snapDir, { recursive: true });
    this._load();
  }

  _load() {
    try {
      this.db = JSON.parse(fs.readFileSync(this.dbPath, 'utf8'));
    } catch (e) {
      this.db = null;
    }
    if (!this.db || typeof this.db !== 'object') {
      this.db = {
        nextId: 1,
        bookmarks: [],
        savedSearches: [],
        nextSavedId: 1,
        prefs: { sort: 'new', pageSize: 20, textSize: 'normal' },
      };
      this._save();
    }
    // fill any missing top-level keys (forward-compatible)
    this.db.bookmarks = this.db.bookmarks || [];
    this.db.savedSearches = this.db.savedSearches || [];
    this.db.prefs = this.db.prefs || { sort: 'new', pageSize: 20, textSize: 'normal' };
    if (!this.db.nextId) this.db.nextId = 1;
    if (!this.db.nextSavedId) this.db.nextSavedId = 1;
  }

  _save() {
    const tmp = this.dbPath + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(this.db, null, 2));
    fs.renameSync(tmp, this.dbPath); // atomic replace
  }

  state() {
    return {
      bookmarks: this.db.bookmarks,
      savedSearches: this.db.savedSearches,
      prefs: this.db.prefs,
    };
  }

  // ----- bookmarks -----
  addBookmark(b) {
    b.id = this.db.nextId++;
    this.db.bookmarks.unshift(b);
    this._save();
    return b;
  }
  getBookmark(id) { return this.db.bookmarks.find(b => b.id === id); }
  updateBookmark(id, patch) {
    const b = this.getBookmark(id);
    if (!b) return null;
    Object.assign(b, patch);
    this._save();
    return b;
  }
  deleteBookmark(id) {
    const b = this.getBookmark(id);
    this.db.bookmarks = this.db.bookmarks.filter(x => x.id !== id);
    this._save();
    return b;
  }

  // ----- snapshots (preserved copies) -----
  snapshotPath(id, kind) {
    return path.join(this.snapDir, id + (kind === 'pdf' ? '.pdf' : '.html'));
  }
  writeSnapshot(id, kind, data) {
    fs.writeFileSync(this.snapshotPath(id, kind), data);
  }
  readSnapshot(id, kind) {
    const p = this.snapshotPath(id, kind);
    if (!fs.existsSync(p)) return null;
    return fs.readFileSync(p);
  }
  deleteSnapshot(id, kind) {
    for (const k of ['page', 'pdf']) {
      const p = this.snapshotPath(id, k);
      if (fs.existsSync(p)) fs.unlinkSync(p);
    }
  }

  // ----- saved searches -----
  addSavedSearch(ss) { ss.id = this.db.nextSavedId++; this.db.savedSearches.push(ss); this._save(); return ss; }
  deleteSavedSearch(id) { this.db.savedSearches = this.db.savedSearches.filter(s => s.id !== id); this._save(); }

  // ----- prefs -----
  setPrefs(p) { this.db.prefs = Object.assign({}, this.db.prefs, p); this._save(); return this.db.prefs; }
}

module.exports = { Store };
