/*
 * Durable private storage (single user). Persists all bookmarks, preferences
 * and saved searches to a JSON file, written atomically on every change.
 * Supports the "private to me and persists between visits" cross-cutting
 * assumption behind every scenario.
 */
const fs = require('fs');
const path = require('path');

const SAME_ADDRESS = (u) => {
  // Same-address rule (SCN-003): ignore a trailing slash and a leading "www.".
  try {
    const url = new URL(u);
    return (url.hostname.replace(/^www\./, '') + url.pathname.replace(/\/$/, '') + url.search).toLowerCase();
  } catch (e) {
    return String(u).trim().toLowerCase();
  }
};

class Store {
  constructor(dataDir) {
    this.dataDir = dataDir;
    this.file = path.join(dataDir, 'bookmarks.json');
    this.snapshotsDir = path.join(dataDir, 'snapshots');
    fs.mkdirSync(this.snapshotsDir, { recursive: true });
    this._load();
  }

  _load() {
    try {
      this.data = JSON.parse(fs.readFileSync(this.file, 'utf8'));
    } catch (e) {
      this.data = null;
    }
    if (!this.data || typeof this.data !== 'object') {
      this.data = {
        bookmarks: [],
        prefs: { sortKey: 'added_desc', pageSize: 10, textSize: 'm' },
        savedSearches: [],
        nextId: 1,
        nextSearchId: 1,
      };
    }
    this.data.bookmarks = this.data.bookmarks || [];
    this.data.savedSearches = this.data.savedSearches || [];
    this.data.prefs = Object.assign({ sortKey: 'added_desc', pageSize: 10, textSize: 'm' }, this.data.prefs || {});
    this.data.nextId = this.data.nextId || (this.data.bookmarks.reduce((m, b) => Math.max(m, b.id), 0) + 1);
    this.data.nextSearchId = this.data.nextSearchId || (this.data.savedSearches.reduce((m, s) => Math.max(m, s.id), 0) + 1);
  }

  _save() {
    const tmp = this.file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2));
    fs.renameSync(tmp, this.file); // atomic replace
  }

  // --- queries -------------------------------------------------------------
  all() { return this.data.bookmarks; }
  get(id) { return this.data.bookmarks.find(b => b.id === id); }
  findByAddress(url) {
    const key = SAME_ADDRESS(url);
    return this.data.bookmarks.find(b => SAME_ADDRESS(b.url) === key);
  }
  prefs() { return this.data.prefs; }
  savedSearches() { return this.data.savedSearches; }

  // --- bookmark mutations --------------------------------------------------
  create(fields) {
    const b = Object.assign({
      id: this.data.nextId++,
      url: '', title: '', desc: '', site: '', tags: [], note: '',
      favicon: null, image: null,
      status: 'toread', archived: false,
      keepCopy: true, isPdf: false, hasSnapshot: false,
      ia: false, iaUrl: null,
      createdAt: Date.now(),
    }, fields);
    this.data.bookmarks.unshift(b);
    this._save();
    return b;
  }

  update(id, fields) {
    const b = this.get(id);
    if (!b) return null;
    Object.assign(b, fields);
    this._save();
    return b;
  }

  remove(id) {
    const i = this.data.bookmarks.findIndex(b => b.id === id);
    if (i < 0) return false;
    this.data.bookmarks.splice(i, 1);
    this._save();
    return true;
  }

  // --- preferences & saved searches ---------------------------------------
  setPrefs(p) {
    this.data.prefs = Object.assign(this.data.prefs, p);
    this._save();
    return this.data.prefs;
  }

  addSearch({ name, query, view }) {
    const s = { id: this.data.nextSearchId++, name, query, view };
    this.data.savedSearches.push(s);
    this._save();
    return s;
  }

  removeSearch(id) {
    const i = this.data.savedSearches.findIndex(s => s.id === id);
    if (i < 0) return false;
    this.data.savedSearches.splice(i, 1);
    this._save();
    return true;
  }
}

module.exports = { Store, SAME_ADDRESS };
