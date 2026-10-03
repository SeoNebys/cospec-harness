import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';

export class BookmarkStore {
  constructor(filePath) {
    this.filePath = filePath;
    this.queue = Promise.resolve();
  }

  async init() {
    await mkdir(dirname(this.filePath), { recursive: true });
    try {
      await readFile(this.filePath, 'utf8');
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      await this.#write([]);
    }
  }

  async all() {
    return this.#read();
  }

  async findById(id) {
    return (await this.#read()).find(item => item.id === id) ?? null;
  }

  async findByCanonical(canonical) {
    return (await this.#read()).find(item => item.canonicalAddress === canonical) ?? null;
  }

  async create(input) {
    return this.#mutate(items => {
      const now = new Date().toISOString();
      const bookmark = { id: randomUUID(), createdAt: now, updatedAt: now, ...input };
      items.push(bookmark);
      return bookmark;
    });
  }

  async update(id, changes) {
    return this.#mutate(items => {
      const index = items.findIndex(item => item.id === id);
      if (index === -1) return null;
      items[index] = { ...items[index], ...changes, id, updatedAt: new Date().toISOString() };
      return items[index];
    });
  }

  async #read() {
    const raw = await readFile(this.filePath, 'utf8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new Error('Bookmark store must contain an array');
    return parsed;
  }

  async #write(items) {
    const temporary = `${this.filePath}.tmp`;
    await writeFile(temporary, `${JSON.stringify(items, null, 2)}\n`, 'utf8');
    await rename(temporary, this.filePath);
  }

  async #mutate(callback) {
    const operation = this.queue.then(async () => {
      const items = await this.#read();
      const result = callback(items);
      await this.#write(items);
      return result;
    });
    this.queue = operation.catch(() => undefined);
    return operation;
  }
}
