// JSON-file-backed bookmark store. Chosen for zero dependencies and easy
// inspection; satisfies persistence-across-sessions (NF-2). The file path is
// injectable so tests can use a temp file. Newest bookmarks are kept first.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const BM = require('./shared');

class Store {
  constructor(filePath) {
    this.filePath = filePath;
    this.bookmarks = this._load();
  }

  _load() {
    try {
      const raw = fs.readFileSync(this.filePath, 'utf8');
      const data = JSON.parse(raw);
      return Array.isArray(data) ? data : [];
    } catch (e) {
      return []; // Missing/empty file => empty library (SCN-005 brand-new user).
    }
  }

  _save() {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    fs.writeFileSync(this.filePath, JSON.stringify(this.bookmarks, null, 2));
  }

  list() {
    return this.bookmarks.slice();
  }

  get(id) {
    return this.bookmarks.find((b) => b.id === id) || null;
  }

  // Duplicate detection by canonical URL (SCN-006).
  findByUrl(url) {
    const key = BM.canonicalUrl(url);
    return this.bookmarks.find((b) => BM.canonicalUrl(b.url) === key) || null;
  }

  // Create a new bookmark at the top of the list (SCN-001 newest-first).
  create({ url, title, needsTitle, tags }) {
    const bookmark = {
      id: crypto.randomUUID(),
      url,
      host: BM.hostOf(url),
      title: title || BM.siteName(url),
      needsTitle: !!needsTitle,
      tags: Array.isArray(tags) ? tags.slice() : [],
      createdAt: new Date().toISOString()
    };
    this.bookmarks.unshift(bookmark);
    this._save();
    return bookmark;
  }

  update(id, fields) {
    const b = this.get(id);
    if (!b) return null;
    if (typeof fields.title === 'string') {
      b.title = fields.title;
      b.needsTitle = false; // The client named it (SCN-006 add-a-name).
    }
    if (typeof fields.needsTitle === 'boolean') b.needsTitle = fields.needsTitle;
    if (Array.isArray(fields.tags)) {
      // De-duplicate and drop empties; preserve order of first appearance.
      const seen = new Set();
      b.tags = fields.tags
        .map((t) => String(t).trim())
        .filter((t) => t && !seen.has(t) && seen.add(t));
    }
    this._save();
    return b;
  }

  remove(id) {
    const idx = this.bookmarks.findIndex((b) => b.id === id);
    if (idx < 0) return false;
    this.bookmarks.splice(idx, 1);
    this._save();
    return true;
  }
}

module.exports = { Store };
