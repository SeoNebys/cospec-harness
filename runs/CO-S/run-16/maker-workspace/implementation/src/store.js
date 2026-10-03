import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

export class BookmarkStore {
  constructor(filePath) {
    this.filePath = filePath;
    this.bookmarks = [];
    this.writeQueue = Promise.resolve();
  }

  async load() {
    await mkdir(dirname(this.filePath), { recursive: true });
    try {
      const contents = await readFile(this.filePath, 'utf8');
      const parsed = JSON.parse(contents);
      this.bookmarks = Array.isArray(parsed.bookmarks) ? parsed.bookmarks : [];
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      await this.save();
    }
    return this.bookmarks;
  }

  list() {
    return this.bookmarks;
  }

  async save() {
    this.writeQueue = this.writeQueue.then(async () => {
      const temporaryPath = `${this.filePath}.tmp`;
      await writeFile(temporaryPath, JSON.stringify({ bookmarks: this.bookmarks }, null, 2));
      await rename(temporaryPath, this.filePath);
    });
    return this.writeQueue;
  }
}
