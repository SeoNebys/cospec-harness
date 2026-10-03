import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { publicBookmark, normalizeUrl } from './bookmarks.js';

export class BookmarkStore {
  constructor(file) { this.file = file; this.data = { bookmarks: [] }; this.writeQueue = Promise.resolve(); }
  async load() {
    await mkdir(dirname(this.file), { recursive: true });
    try { this.data = JSON.parse(await readFile(this.file, 'utf8')); }
    catch (error) { if (error.code !== 'ENOENT') throw error; await this.persist(); }
    if (!Array.isArray(this.data.bookmarks)) this.data = { bookmarks: [] };
  }
  list() { return [...this.data.bookmarks].sort((a, b) => b.createdAt.localeCompare(a.createdAt)); }
  get(id) { return this.data.bookmarks.find(item => item.id === id); }
  findByUrl(url) { const normalized = normalizeUrl(url); return this.data.bookmarks.find(item => item.url === normalized); }
  async create(input) {
    const bookmark = publicBookmark(input);
    if (!bookmark.title) throw new Error('A title is required.');
    const existing = this.findByUrl(bookmark.url);
    if (existing) return { bookmark: existing, duplicate: true };
    this.data.bookmarks.push(bookmark); await this.persist(); return { bookmark, duplicate: false };
  }
  async update(id, patch) {
    const index = this.data.bookmarks.findIndex(item => item.id === id);
    if (index < 0) return null;
    const next = publicBookmark({ ...this.data.bookmarks[index], ...patch, id, createdAt: this.data.bookmarks[index].createdAt });
    if (!next.title) throw new Error('A title is required.');
    const collision = this.data.bookmarks.find(item => item.id !== id && item.url === next.url);
    if (collision) throw new Error('That page is already saved.');
    this.data.bookmarks[index] = next; await this.persist(); return next;
  }
  async persist() {
    this.writeQueue = this.writeQueue.then(async () => {
      const temporary = `${this.file}.tmp`;
      await writeFile(temporary, JSON.stringify(this.data, null, 2));
      await rename(temporary, this.file);
    });
    return this.writeQueue;
  }
}
