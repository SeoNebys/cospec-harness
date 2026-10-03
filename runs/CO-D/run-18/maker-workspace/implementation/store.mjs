import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

export function normalizeUrl(raw) {
  const url = new URL(raw);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Only HTTP and HTTPS addresses are supported');
  url.hash = '';
  for (const key of [...url.searchParams.keys()]) {
    if (/^(utm_|fbclid$|gclid$|mc_cid$|mc_eid$)/i.test(key)) url.searchParams.delete(key);
  }
  url.hostname = url.hostname.toLowerCase();
  if (url.pathname !== '/') url.pathname = url.pathname.replace(/\/+$/, '');
  url.searchParams.sort();
  return url.toString();
}

export function comparableTag(value) {
  return value.trim().toLocaleLowerCase().replace(/s$/, '');
}

export function canonicalTag(value, existingTags = []) {
  const clean = value.trim();
  return existingTags.find(tag => comparableTag(tag) === comparableTag(clean)) || clean;
}

export class BookmarkStore {
  constructor(file) { this.file = file; this.items = []; }

  async load() {
    await mkdir(path.dirname(this.file), { recursive: true });
    try { this.items = JSON.parse(await readFile(this.file, 'utf8')); }
    catch (error) { if (error.code !== 'ENOENT') throw error; this.items = []; await this.save(); }
    return this.items;
  }

  async save() { await writeFile(this.file, JSON.stringify(this.items, null, 2)); }
  all() { return structuredClone(this.items); }
  tags() { return [...new Set(this.items.flatMap(item => item.tags || []))].sort((a,b) => a.localeCompare(b)); }
  findByUrl(raw) { const normalized = normalizeUrl(raw); return this.items.find(item => item.normalizedUrl === normalized) || null; }
  get(id) { return this.items.find(item => item.id === id) || null; }

  async create(input) {
    if (this.findByUrl(input.url)) throw Object.assign(new Error('Bookmark already exists'), { code: 'DUPLICATE' });
    const now = new Date().toISOString();
    const item = {
      id: randomUUID(), url: input.url, normalizedUrl: normalizeUrl(input.url),
      title: input.title.trim(), description: input.description?.trim() || '',
      noteHtml: input.noteHtml || '', tags: input.tags || [], readLater: Boolean(input.readLater),
      archived: false, siteName: input.siteName || new URL(input.url).hostname,
      favicon: input.favicon || '', thumbnail: input.thumbnail || '', createdAt: now, updatedAt: now
    };
    if (!item.title) throw new Error('Title is required');
    this.items.unshift(item); await this.save(); return structuredClone(item);
  }

  async update(id, changes) {
    const item = this.get(id); if (!item) return null;
    const allowed = ['title','description','noteHtml','tags','readLater','archived','siteName','favicon','thumbnail'];
    for (const key of allowed) if (key in changes) item[key] = changes[key];
    if (!item.title?.trim()) throw new Error('Title is required');
    item.updatedAt = new Date().toISOString(); await this.save(); return structuredClone(item);
  }

  async bulk(ids, action, value) {
    const selected = this.items.filter(item => ids.includes(item.id));
    if (action === 'addTag') {
      const tag = canonicalTag(value, this.tags());
      for (const item of selected) if (!item.tags.some(existing => comparableTag(existing) === comparableTag(tag))) item.tags.push(tag);
    } else if (action === 'readLater') selected.forEach(item => item.readLater = Boolean(value));
    else if (action === 'archive') selected.forEach(item => item.archived = true);
    else throw new Error('Unknown bulk action');
    const now = new Date().toISOString(); selected.forEach(item => item.updatedAt = now);
    await this.save(); return structuredClone(selected);
  }

  async deleteArchived(ids) {
    const selected = this.items.filter(item => ids.includes(item.id));
    if (selected.some(item => !item.archived)) throw new Error('Only archived bookmarks can be permanently deleted');
    this.items = this.items.filter(item => !ids.includes(item.id)); await this.save(); return selected.length;
  }
}
