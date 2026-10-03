// JSON-file persistence for bookmarks, saved searches, and display preferences.
// Single-user local app; atomic writes via temp file + rename.
import fs from 'fs';
import path from 'path';

const DEFAULT_PREFS = { defaultSort: 'added_desc', pageSize: 25, textSize: 'medium' };

export class Store {
  constructor(file) {
    this.file = file;
    this.dir = path.dirname(file);
    this.data = { bookmarks: [], savedSearches: [], prefs: { ...DEFAULT_PREFS } };
    this._load();
  }

  _load() {
    try {
      const raw = fs.readFileSync(this.file, 'utf8');
      const parsed = JSON.parse(raw);
      this.data = {
        bookmarks: Array.isArray(parsed.bookmarks) ? parsed.bookmarks : [],
        savedSearches: Array.isArray(parsed.savedSearches) ? parsed.savedSearches : [],
        prefs: { ...DEFAULT_PREFS, ...(parsed.prefs || {}) },
      };
    } catch {
      // no file yet or unreadable -> start fresh
    }
  }

  _persist() {
    if (!fs.existsSync(this.dir)) fs.mkdirSync(this.dir, { recursive: true });
    const tmp = this.file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2));
    fs.renameSync(tmp, this.file);
  }

  // ---- bookmarks ----
  all() { return this.data.bookmarks; }
  find(id) { return this.data.bookmarks.find((b) => String(b.id) === String(id)); }
  add(b) { this.data.bookmarks.unshift(b); this._persist(); return b; }
  update(id, patch) {
    const b = this.find(id);
    if (!b) return null;
    Object.assign(b, patch);
    this._persist();
    return b;
  }
  remove(id) {
    const before = this.data.bookmarks.length;
    this.data.bookmarks = this.data.bookmarks.filter((b) => String(b.id) !== String(id));
    if (this.data.bookmarks.length !== before) this._persist();
  }
  removeMany(ids) {
    const set = new Set(ids.map(String));
    this.data.bookmarks = this.data.bookmarks.filter((b) => !set.has(String(b.id)));
    this._persist();
  }
  persist() { this._persist(); }

  // ---- saved searches ----
  savedSearches() { return this.data.savedSearches; }
  addSavedSearch(s) { this.data.savedSearches.push(s); this._persist(); return s; }
  removeSavedSearch(id) {
    this.data.savedSearches = this.data.savedSearches.filter((s) => String(s.id) !== String(id));
    this._persist();
  }

  // ---- preferences ----
  prefs() { return this.data.prefs; }
  setPrefs(patch) { Object.assign(this.data.prefs, patch); this._persist(); return this.data.prefs; }
}
