import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

export class BookmarkStore {
  constructor(file) {
    this.file = file;
    this.bookmarks = [];
    this.ready = false;
    this.writeQueue = Promise.resolve();
  }

  async load() {
    if (this.ready) return this;
    await mkdir(dirname(this.file), { recursive: true });
    try {
      const parsed = JSON.parse(await readFile(this.file, 'utf8'));
      this.bookmarks = Array.isArray(parsed.bookmarks) ? parsed.bookmarks : [];
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      this.bookmarks = [];
      await this.persist();
    }
    this.ready = true;
    return this;
  }

  list() {
    return this.bookmarks.map(item => structuredClone(item));
  }

  get(id) {
    const item = this.bookmarks.find(bookmark => bookmark.id === id);
    return item ? structuredClone(item) : null;
  }

  async insert(bookmark) {
    this.bookmarks.unshift(structuredClone(bookmark));
    await this.persist();
    return this.get(bookmark.id);
  }

  async replace(id, bookmark) {
    const index = this.bookmarks.findIndex(item => item.id === id);
    if (index < 0) return null;
    this.bookmarks[index] = structuredClone(bookmark);
    await this.persist();
    return this.get(id);
  }

  async remove(id) {
    const index = this.bookmarks.findIndex(item => item.id === id);
    if (index < 0) return null;
    const [removed] = this.bookmarks.splice(index, 1);
    await this.persist();
    return structuredClone(removed);
  }

  async clear() {
    this.bookmarks = [];
    await this.persist();
  }

  async persist() {
    const payload = JSON.stringify({ version: 1, bookmarks: this.bookmarks }, null, 2);
    const temp = `${this.file}.tmp`;
    this.writeQueue = this.writeQueue.then(async () => {
      await writeFile(temp, payload, 'utf8');
      await rename(temp, this.file);
    });
    await this.writeQueue;
  }
}
