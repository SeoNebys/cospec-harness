import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';

export function normalizeAddress(raw) {
  const text = String(raw ?? '').trim();
  let parsed;
  try { parsed = new URL(text); } catch { throw new Error('INVALID_URL'); }
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('INVALID_URL');
  return parsed.href;
}

export class BookmarkStore {
  constructor(filePath) {
    this.filePath = filePath;
    this.state = { bookmarks: [] };
    this.ready = this.#load();
    this.writeQueue = Promise.resolve();
  }

  async #load() {
    await mkdir(dirname(this.filePath), { recursive: true });
    try {
      const parsed = JSON.parse(await readFile(this.filePath, 'utf8'));
      if (Array.isArray(parsed.bookmarks)) this.state = parsed;
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }

  async #persist() {
    const temp = `${this.filePath}.tmp`;
    await writeFile(temp, JSON.stringify(this.state, null, 2));
    await rename(temp, this.filePath);
  }

  async #commit(work) {
    await this.ready;
    let result;
    this.writeQueue = this.writeQueue.then(async () => {
      result = work();
      await this.#persist();
    });
    await this.writeQueue;
    return structuredClone(result);
  }

  async all() {
    await this.ready;
    return structuredClone(this.state.bookmarks);
  }

  async findByAddress(address) {
    await this.ready;
    const normalized = normalizeAddress(address);
    const found = this.state.bookmarks.find((item) => item.normalizedUrl === normalized);
    return found ? structuredClone(found) : null;
  }

  async create(input) {
    return this.#commit(() => {
      const normalizedUrl = normalizeAddress(input.url);
      const existing = this.state.bookmarks.find((item) => item.normalizedUrl === normalizedUrl);
      if (existing) return { bookmark: existing, duplicate: true };
      const now = new Date().toISOString();
      const bookmark = {
        id: randomUUID(),
        url: normalizedUrl,
        normalizedUrl,
        title: input.title,
        description: input.description ?? '',
        siteName: input.siteName ?? new URL(normalizedUrl).hostname,
        iconUrl: input.iconUrl ?? '',
        imageUrl: input.imageUrl ?? '',
        enrichment: input.enrichment ?? 'complete',
        note: '',
        tags: [],
        readLater: false,
        archived: false,
        createdAt: now,
        updatedAt: now
      };
      this.state.bookmarks.unshift(bookmark);
      return { bookmark, duplicate: false };
    });
  }

  async update(id, changes) {
    return this.#commit(() => {
      const item = this.state.bookmarks.find((bookmark) => bookmark.id === id);
      if (!item) throw new Error('NOT_FOUND');
      for (const field of ['title', 'description', 'note', 'readLater', 'archived', 'siteName', 'iconUrl', 'imageUrl', 'enrichment']) {
        if (Object.hasOwn(changes, field)) item[field] = changes[field];
      }
      if (Array.isArray(changes.tags)) item.tags = [...new Set(changes.tags.map((tag) => String(tag).trim()).filter(Boolean))];
      item.updatedAt = new Date().toISOString();
      return item;
    });
  }

  async remove(id) {
    return this.#commit(() => {
      const index = this.state.bookmarks.findIndex((bookmark) => bookmark.id === id);
      if (index < 0) throw new Error('NOT_FOUND');
      return this.state.bookmarks.splice(index, 1)[0];
    });
  }

  async bulk(ids, action, tag) {
    const uniqueIds = [...new Set(ids)];
    return this.#commit(() => {
      const selected = this.state.bookmarks.filter((item) => uniqueIds.includes(item.id));
      if (action === 'tag') {
        const cleaned = String(tag ?? '').trim();
        if (!cleaned) throw new Error('TAG_REQUIRED');
        selected.forEach((item) => { if (!item.tags.includes(cleaned)) item.tags.push(cleaned); });
      } else if (action === 'archive') {
        selected.forEach((item) => { item.archived = true; });
      } else if (action === 'delete') {
        this.state.bookmarks = this.state.bookmarks.filter((item) => !uniqueIds.includes(item.id));
      } else throw new Error('INVALID_ACTION');
      const now = new Date().toISOString();
      selected.forEach((item) => { item.updatedAt = now; });
      return { count: selected.length };
    });
  }

  async tags() {
    await this.ready;
    return [...new Set(this.state.bookmarks.flatMap((item) => item.tags))].sort((a, b) => a.localeCompare(b));
  }
}

export function filterBookmarks(items, { view = 'all', query = '', tag = '', sort = 'added' } = {}) {
  let result = items.filter((item) => view === 'archive' ? item.archived : !item.archived);
  if (view === 'readLater') result = result.filter((item) => item.readLater);
  if (tag) result = result.filter((item) => item.tags.includes(tag));
  const needle = query.trim().toLocaleLowerCase();
  if (needle) {
    result = result.filter((item) => [item.title, item.description, item.note, item.url].some((value) => String(value).toLocaleLowerCase().includes(needle)));
  }
  result.sort((a, b) => sort === 'title' ? a.title.localeCompare(b.title) : b.createdAt.localeCompare(a.createdAt));
  return result;
}
