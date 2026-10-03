import fs from 'node:fs/promises';
import path from 'node:path';

const EMPTY = { bookmarks: [], preferences: { sort: 'recent' } };

export class Store {
  constructor(file) { this.file = file; this.data = structuredClone(EMPTY); this.queue = Promise.resolve(); }
  async load() {
    try { this.data = { ...structuredClone(EMPTY), ...JSON.parse(await fs.readFile(this.file, 'utf8')) }; }
    catch (error) { if (error.code !== 'ENOENT') throw error; await this.save(); }
    return this.data;
  }
  async save() {
    this.queue = this.queue.then(async () => { await fs.mkdir(path.dirname(this.file), { recursive: true }); const temp = `${this.file}.tmp`; await fs.writeFile(temp, JSON.stringify(this.data, null, 2)); await fs.rename(temp, this.file); });
    return this.queue;
  }
  async mutate(change) { const result = await change(this.data); await this.save(); return result; }
}
