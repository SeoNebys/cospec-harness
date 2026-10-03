import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

const EMPTY_STATE = { nextId: 1, bookmarks: [] };

export class BookmarkStore {
  static async open(filePath) {
    const store = new BookmarkStore(filePath);
    await store.#load();
    return store;
  }

  constructor(filePath) {
    this.filePath = filePath;
    this.state = structuredClone(EMPTY_STATE);
    this.writeChain = Promise.resolve();
  }

  async #load() {
    try {
      const parsed = JSON.parse(await readFile(this.filePath, 'utf8'));
      if (!Array.isArray(parsed.bookmarks) || !Number.isInteger(parsed.nextId)) throw new Error('Invalid bookmark data');
      this.state = parsed;
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      await this.#persist();
    }
  }

  async #persist() {
    const snapshot = JSON.stringify(this.state, null, 2);
    this.writeChain = this.writeChain.then(async () => {
      await mkdir(dirname(this.filePath), { recursive: true });
      const temporaryPath = `${this.filePath}.tmp`;
      await writeFile(temporaryPath, snapshot, 'utf8');
      await rename(temporaryPath, this.filePath);
    });
    return this.writeChain;
  }

  list() {
    return structuredClone(this.state.bookmarks);
  }

  findByCanonicalUrl(canonicalUrl) {
    const bookmark = this.state.bookmarks.find((item) => item.canonicalUrl === canonicalUrl);
    return bookmark ? structuredClone(bookmark) : null;
  }

  get(id) {
    const bookmark = this.state.bookmarks.find((item) => item.id === Number(id));
    return bookmark ? structuredClone(bookmark) : null;
  }

  async insert(bookmark) {
    const stored = { ...structuredClone(bookmark), id: this.state.nextId++ };
    this.state.bookmarks.push(stored);
    await this.#persist();
    return structuredClone(stored);
  }

  async update(id, changes) {
    const index = this.state.bookmarks.findIndex((item) => item.id === Number(id));
    if (index === -1) return null;
    this.state.bookmarks[index] = { ...this.state.bookmarks[index], ...structuredClone(changes) };
    await this.#persist();
    return structuredClone(this.state.bookmarks[index]);
  }
}
