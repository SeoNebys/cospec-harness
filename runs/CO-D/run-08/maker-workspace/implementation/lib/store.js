import fs from 'node:fs/promises';
import path from 'node:path';

export class BookmarkStore {
  constructor(file) { this.file = file; this.items = []; this.ready = this.load(); this.queue = Promise.resolve(); }
  async load() {
    await fs.mkdir(path.dirname(this.file), { recursive: true });
    try { this.items = JSON.parse(await fs.readFile(this.file, 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  async all() { await this.ready; return structuredClone(this.items); }
  async commit(next) {
    await this.ready;
    this.queue = this.queue.then(async () => {
      const temp = `${this.file}.tmp`;
      await fs.writeFile(temp, JSON.stringify(next, null, 2));
      await fs.rename(temp, this.file);
      this.items = next;
    });
    await this.queue;
    return structuredClone(this.items);
  }
}
