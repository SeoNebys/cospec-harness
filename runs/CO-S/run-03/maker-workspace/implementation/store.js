const fs = require('node:fs/promises');
const path = require('node:path');

class BookmarkStore {
  constructor(filePath) {
    this.filePath = filePath;
    this.data = { bookmarks: [] };
    this.loaded = false;
    this.mutationQueue = Promise.resolve();
  }

  async load() {
    if (this.loaded) return;
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    try {
      const contents = await fs.readFile(this.filePath, 'utf8');
      const parsed = JSON.parse(contents);
      this.data = { bookmarks: Array.isArray(parsed.bookmarks) ? parsed.bookmarks : [] };
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      await this.persist();
    }
    this.loaded = true;
  }

  async persist() {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    const temporaryPath = `${this.filePath}.${process.pid}.tmp`;
    await fs.writeFile(temporaryPath, `${JSON.stringify(this.data, null, 2)}\n`, 'utf8');
    await fs.rename(temporaryPath, this.filePath);
  }

  async list() {
    await this.load();
    return structuredClone(this.data.bookmarks);
  }

  async findByUrl(url) {
    await this.load();
    const bookmark = this.data.bookmarks.find((item) => item.url === url);
    return bookmark ? structuredClone(bookmark) : null;
  }

  async create(bookmark) {
    return this.mutate((bookmarks) => {
      bookmarks.push(bookmark);
      return structuredClone(bookmark);
    });
  }

  async update(id, changes) {
    return this.mutate((bookmarks) => {
      const bookmark = bookmarks.find((item) => item.id === id);
      if (!bookmark) return null;
      Object.assign(bookmark, changes, { updatedAt: new Date().toISOString() });
      return structuredClone(bookmark);
    });
  }

  async delete(id) {
    return this.mutate((bookmarks) => {
      const index = bookmarks.findIndex((item) => item.id === id);
      if (index === -1) return null;
      return structuredClone(bookmarks.splice(index, 1)[0]);
    });
  }

  async mutate(operation) {
    const run = async () => {
      await this.load();
      const result = operation(this.data.bookmarks);
      if (result !== null) await this.persist();
      return result;
    };
    this.mutationQueue = this.mutationQueue.then(run, run);
    return this.mutationQueue;
  }
}

module.exports = { BookmarkStore };
