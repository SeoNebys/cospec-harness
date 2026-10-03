import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

export class JsonStore {
  constructor(filePath, seed = []) {
    this.filePath = filePath;
    this.seed = structuredClone(seed);
    this.writeQueue = Promise.resolve();
  }

  async initialize() {
    await mkdir(dirname(this.filePath), { recursive: true });
    try {
      await readFile(this.filePath, 'utf8');
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      await this.replace(this.seed);
    }
  }

  async all() {
    const content = await readFile(this.filePath, 'utf8');
    return JSON.parse(content);
  }

  async replace(bookmarks) {
    const snapshot = structuredClone(bookmarks);
    this.writeQueue = this.writeQueue.then(async () => {
      const temporary = `${this.filePath}.tmp`;
      await writeFile(temporary, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
      await rename(temporary, this.filePath);
    });
    await this.writeQueue;
    return snapshot;
  }

  async reset() {
    return this.replace(this.seed);
  }
}
