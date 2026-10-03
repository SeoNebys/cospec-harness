import fs from 'node:fs/promises';
import path from 'node:path';

const DEFAULT_STATE = {
  version: 1,
  bookmarks: [],
  savedSearches: [],
  settings: { pageSize: 25, textSize: 'comfortable', defaultSort: 'newest' }
};

export class Store {
  constructor(file) { this.file = file; this.state = structuredClone(DEFAULT_STATE); this.queue = Promise.resolve(); }
  async load() {
    try { this.state = { ...structuredClone(DEFAULT_STATE), ...JSON.parse(await fs.readFile(this.file, 'utf8')) }; }
    catch (error) { if (error.code !== 'ENOENT') throw error; await this.save(); }
    return this.state;
  }
  read() { return structuredClone(this.state); }
  async update(mutator) {
    let result;
    this.queue = this.queue.catch(() => {}).then(async () => {
      const draft = structuredClone(this.state);
      result = await mutator(draft);
      this.state = draft;
      await this.save();
    });
    await this.queue;
    return result;
  }
  async replace(state) {
    this.state = { ...structuredClone(DEFAULT_STATE), ...structuredClone(state), version: 1 };
    await this.save();
  }
  async save() {
    await fs.mkdir(path.dirname(this.file), { recursive: true });
    const temp = `${this.file}.${process.pid}.tmp`;
    await fs.writeFile(temp, JSON.stringify(this.state, null, 2));
    await fs.rename(temp, this.file);
  }
}
