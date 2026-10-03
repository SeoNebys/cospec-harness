import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

export class LibraryStore {
  constructor(filePath) {
    this.filePath = filePath;
    this.data = { version: 1, bookmarks: [] };
    this.writeQueue = Promise.resolve();
    this.mutationQueue = Promise.resolve();
  }

  async init() {
    await mkdir(path.dirname(this.filePath), { recursive: true });
    try {
      const parsed = JSON.parse(await readFile(this.filePath, "utf8"));
      if (!Array.isArray(parsed.bookmarks)) throw new Error("Invalid library file");
      this.data = { version: 1, ...parsed };
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      await this.persist();
    }
  }

  snapshot() {
    return structuredClone(this.data);
  }

  async mutate(callback) {
    const operation = this.mutationQueue.then(async () => {
      const next = structuredClone(this.data);
      const result = await callback(next);
      this.data = next;
      await this.persist();
      return result;
    });
    this.mutationQueue = operation.then(() => undefined, () => undefined);
    return operation;
  }

  async persist() {
    const payload = `${JSON.stringify(this.data, null, 2)}\n`;
    const temporary = `${this.filePath}.tmp`;
    this.writeQueue = this.writeQueue.then(async () => {
      await writeFile(temporary, payload, "utf8");
      await rename(temporary, this.filePath);
    });
    return this.writeQueue;
  }
}
