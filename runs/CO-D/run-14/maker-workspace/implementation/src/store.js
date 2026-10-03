import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { demoPageFor, makeBookmark } from './core.js';

export class JsonStore {
  constructor(file, publicOrigin = 'http://maker:4000') {
    this.file = file;
    this.publicOrigin = publicOrigin.replace(/\/$/, '');
    this.state = null;
    this.queue = Promise.resolve();
  }

  async load() {
    if (this.state) return this.state;
    try {
      this.state = JSON.parse(await readFile(this.file, 'utf8'));
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      this.state = this.seed();
      await this.save();
    }
    this.state.bookmarks ??= [];
    return this.state;
  }

  seed() {
    const create = (slug, tags, notes, readLater = false) => {
      const url = `${this.publicOrigin}/demo/original/${slug}`;
      return makeBookmark({ url, details: demoPageFor(url), tags, notes, readLater });
    };
    const rome = create('rome', ['travel', 'articles'], 'Revisit the Trastevere route before October.', true);
    const water = create('water', ['research', 'articles'], 'Save the aqueduct diagrams.', false);
    const trees = create('trees', ['cities', 'articles'], 'A page worth keeping even if the small publisher disappears.', true);
    trees.originalAvailable = false;
    return { version: 1, bookmarks: [rome, water, trees] };
  }

  async save() {
    await mkdir(dirname(this.file), { recursive: true });
    const temp = `${this.file}.tmp`;
    const payload = `${JSON.stringify(this.state, null, 2)}\n`;
    this.queue = this.queue.then(async () => {
      await writeFile(temp, payload, 'utf8');
      await rename(temp, this.file);
    });
    return this.queue;
  }

  async list() { return (await this.load()).bookmarks; }
  async find(id) { return (await this.list()).find(bookmark => bookmark.id === id); }
  async mutate(callback) {
    const state = await this.load();
    const result = await callback(state);
    await this.save();
    return result;
  }
}
