import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { canonicalAddress } from './url.js';
import { normalizeTags } from './tags.js';

export class BookmarkStore {
  constructor(file) { this.file = file; this.queue = Promise.resolve(); }
  async init() { await fs.mkdir(path.dirname(this.file), { recursive: true }); try { await fs.access(this.file); } catch { await fs.writeFile(this.file, '[]\n'); } }
  async all() { return JSON.parse(await fs.readFile(this.file, 'utf8')); }
  async write(items) {
    const temp = `${this.file}.${process.pid}.tmp`;
    await fs.writeFile(temp, JSON.stringify(items, null, 2) + '\n');
    await fs.rename(temp, this.file);
  }
  mutate(operation) {
    const run = this.queue.then(async () => { const items = await this.all(); const result = await operation(items); await this.write(items); return result; });
    this.queue = run.catch(() => {}); return run;
  }
  async findByUrl(url) { const canonical = canonicalAddress(url); return (await this.all()).find(item => item.url === canonical) || null; }
  async list({ query = '', tag = '', readLater = false } = {}) {
    const term = query.trim().toLocaleLowerCase(); const exactTag = tag.trim().toLocaleLowerCase();
    return (await this.all()).filter(item => !readLater || item.readLater).filter(item => !exactTag || item.tags.includes(exactTag)).filter(item => !term || [item.title, item.description, ...item.tags].some(value => value.toLocaleLowerCase().includes(term))).sort((a,b) => b.createdAt.localeCompare(a.createdAt));
  }
  async tags() { return [...new Set((await this.all()).flatMap(item => item.tags))].sort(); }
  create(input) { return this.mutate(items => {
    const url = canonicalAddress(input.url); if (items.some(item => item.url === url)) { const error = new Error('This address is already saved.'); error.code='DUPLICATE'; throw error; }
    const now = new Date().toISOString();
    const item = { id: crypto.randomUUID(), url, title: String(input.title || '').trim(), description: String(input.description || '').trim(), tags: normalizeTags(input.tags), readLater: Boolean(input.readLater), createdAt: now, updatedAt: now };
    if (!item.title) throw new Error('A title is required.'); items.push(item); return item;
  }); }
  update(id, input) { return this.mutate(items => {
    const item = items.find(entry => entry.id === id); if (!item) { const error=new Error('Bookmark not found.'); error.code='NOT_FOUND'; throw error; }
    const url = canonicalAddress(input.url); if (items.some(entry => entry.id !== id && entry.url === url)) { const error = new Error('This address is already saved.'); error.code='DUPLICATE'; throw error; }
    Object.assign(item, { url, title:String(input.title || '').trim(), description:String(input.description || '').trim(), tags:normalizeTags(input.tags), updatedAt:new Date().toISOString() });
    if (!item.title) throw new Error('A title is required.'); return item;
  }); }
  toggleReadLater(id) { return this.mutate(items => { const item=items.find(entry => entry.id === id); if (!item) { const error=new Error('Bookmark not found.'); error.code='NOT_FOUND'; throw error; } item.readLater=!item.readLater; item.updatedAt=new Date().toISOString(); return item; }); }
  remove(id) { return this.mutate(items => { const index=items.findIndex(entry => entry.id === id); if (index<0) { const error=new Error('Bookmark not found.'); error.code='NOT_FOUND'; throw error; } return items.splice(index,1)[0]; }); }
}
