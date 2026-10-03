import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { dirname } from 'node:path';

export class BookmarkStore {
  constructor(file) { this.file = file; this.queue = Promise.resolve(); }

  async read() {
    try {
      const data = JSON.parse(await readFile(this.file, 'utf8'));
      return Array.isArray(data.bookmarks) ? data : { bookmarks: [] };
    } catch (error) {
      if (error.code === 'ENOENT') return { bookmarks: [] };
      throw error;
    }
  }

  async write(data) {
    await mkdir(dirname(this.file), { recursive: true });
    const temporary = `${this.file}.${process.pid}.tmp`;
    await writeFile(temporary, JSON.stringify(data, null, 2));
    await rename(temporary, this.file);
  }

  mutate(fn) {
    const operation = this.queue.then(async () => {
      const data = await this.read();
      const result = await fn(data);
      await this.write(data);
      return result;
    });
    this.queue = operation.catch(() => {});
    return operation;
  }
}
