import fs from 'node:fs/promises';
import path from 'node:path';

// Persistent, single-user bookmark collection backed by a JSON file.
// Newest bookmarks are kept at the front of the list.

const ALLOWED_FIELDS = ['url', 'title', 'site', 'desc', 'tags', 'note', 'readLater', 'archived'];

function cleanTags(tags) {
  if (!Array.isArray(tags)) return [];
  return tags.map(t => String(t).trim()).filter(Boolean);
}

function newBookmark(input, id) {
  return {
    id,
    url: String(input.url || '').trim(),
    title: String(input.title || '').trim() || String(input.url || '').trim(),
    site: String(input.site || '').trim(),
    desc: String(input.desc || '').trim(),
    tags: cleanTags(input.tags),
    note: String(input.note || '').trim(),
    readLater: Boolean(input.readLater),
    archived: Boolean(input.archived),
    createdAt: new Date().toISOString()
  };
}

function sanitizeUpdate(input) {
  const out = {};
  for (const key of ALLOWED_FIELDS) {
    if (!(key in input)) continue;
    if (key === 'tags') out.tags = cleanTags(input.tags);
    else if (key === 'readLater' || key === 'archived') out[key] = Boolean(input[key]);
    else out[key] = String(input[key] ?? '').trim();
  }
  return out;
}

export class Store {
  constructor(file) {
    this.file = file;
    this.data = { bookmarks: [], nextId: 1 };
  }

  async init() {
    try {
      const raw = await fs.readFile(this.file, 'utf8');
      const parsed = JSON.parse(raw);
      this.data.bookmarks = Array.isArray(parsed.bookmarks) ? parsed.bookmarks : [];
      this.data.nextId = Number.isInteger(parsed.nextId) ? parsed.nextId : this._computeNextId();
    } catch {
      this.data = { bookmarks: [], nextId: 1 };
      await this._persist();
    }
    return this;
  }

  _computeNextId() {
    return this.data.bookmarks.reduce((m, b) => Math.max(m, b.id), 0) + 1;
  }

  async _persist() {
    await fs.mkdir(path.dirname(this.file), { recursive: true });
    await fs.writeFile(this.file, JSON.stringify(this.data, null, 2));
  }

  all() {
    return this.data.bookmarks;
  }

  get(id) {
    return this.data.bookmarks.find(b => String(b.id) === String(id)) || null;
  }

  async create(input) {
    const b = newBookmark(input, this.data.nextId++);
    this.data.bookmarks.unshift(b);
    await this._persist();
    return b;
  }

  async update(id, input) {
    const b = this.get(id);
    if (!b) return null;
    Object.assign(b, sanitizeUpdate(input));
    await this._persist();
    return b;
  }

  async remove(id) {
    const i = this.data.bookmarks.findIndex(b => String(b.id) === String(id));
    if (i === -1) return false;
    this.data.bookmarks.splice(i, 1);
    await this._persist();
    return true;
  }

  async reset() {
    this.data = { bookmarks: [], nextId: 1 };
    await this._persist();
  }
}
