// Durable JSON persistence for the single-user collection (SCN durability note).
// The whole dataset is small (personal use); we keep it in memory and write it
// atomically on every change.

import fs from 'fs';
import path from 'path';

export class Store {
  constructor(dataDir) {
    this.dataDir = dataDir;
    this.file = path.join(dataDir, 'db.json');
    this.offlineDir = path.join(dataDir, 'offline');
    fs.mkdirSync(this.offlineDir, { recursive: true });
    this.data = this._load();
  }

  _load() {
    try {
      const raw = fs.readFileSync(this.file, 'utf8');
      const parsed = JSON.parse(raw);
      return {
        bookmarks: parsed.bookmarks || [],
        savedSearches: parsed.savedSearches || [],
        prefs: Object.assign({ defaultSort: 'added-desc', pageSize: 25, textSize: 'md' }, parsed.prefs || {}),
        seq: parsed.seq || 0,
      };
    } catch {
      return {
        bookmarks: [],
        savedSearches: [],
        prefs: { defaultSort: 'added-desc', pageSize: 25, textSize: 'md' },
        seq: 0,
      };
    }
  }

  save() {
    const tmp = this.file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2));
    fs.renameSync(tmp, this.file);
  }

  nextId() {
    this.data.seq = (this.data.seq || 0) + 1;
    return 'b' + this.data.seq;
  }

  get bookmarks() { return this.data.bookmarks; }
  get savedSearches() { return this.data.savedSearches; }
  get prefs() { return this.data.prefs; }

  findBookmark(id) { return this.data.bookmarks.find((b) => b.id === id); }
}
