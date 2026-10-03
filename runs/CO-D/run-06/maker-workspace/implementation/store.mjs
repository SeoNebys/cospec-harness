import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

export function parseWebAddress(value) {
  let parsed;
  try {
    parsed = new URL(String(value ?? '').trim());
  } catch {
    throw new Error('Enter a complete web address, such as https://example.com');
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Enter a complete web address, such as https://example.com');
  }
  return parsed;
}

export function canonicalizeAddress(value) {
  const parsed = parseWebAddress(value);
  parsed.hash = '';
  parsed.hostname = parsed.hostname.toLowerCase();
  if ((parsed.protocol === 'https:' && parsed.port === '443') || (parsed.protocol === 'http:' && parsed.port === '80')) {
    parsed.port = '';
  }
  parsed.pathname = parsed.pathname.replace(/\/+$/, '') || '/';
  const normalized = parsed.href;
  return normalized.endsWith('/') && parsed.pathname === '/' && !parsed.search
    ? normalized.slice(0, -1)
    : normalized;
}

export function normalizeTags(tags) {
  const normalized = [];
  const seen = new Set();
  for (const raw of Array.isArray(tags) ? tags : []) {
    const tag = String(raw).trim().toLowerCase();
    if (!tag || seen.has(tag)) continue;
    seen.add(tag);
    normalized.push(tag);
  }
  return normalized;
}

export class BookmarkStore {
  constructor(filePath, { undoWindowMs = 8000 } = {}) {
    this.filePath = filePath;
    this.undoWindowMs = undoWindowMs;
    this.state = { bookmarks: [] };
    this.ready = this.#load();
    this.purgeTimers = new Map();
  }

  async #load() {
    try {
      const parsed = JSON.parse(await readFile(this.filePath, 'utf8'));
      this.state = { bookmarks: Array.isArray(parsed.bookmarks) ? parsed.bookmarks : [] };
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      await this.#persist();
    }

    const now = Date.now();
    let changed = false;
    this.state.bookmarks = this.state.bookmarks.filter((bookmark) => {
      if (!bookmark.deletedAt) return true;
      if (now - bookmark.deletedAt >= this.undoWindowMs) {
        changed = true;
        return false;
      }
      this.#schedulePurge(bookmark.id, this.undoWindowMs - (now - bookmark.deletedAt));
      return true;
    });
    if (changed) await this.#persist();
  }

  async #persist() {
    await mkdir(dirname(this.filePath), { recursive: true });
    const temporary = `${this.filePath}.tmp`;
    await writeFile(temporary, `${JSON.stringify(this.state, null, 2)}\n`, 'utf8');
    await rename(temporary, this.filePath);
  }

  #schedulePurge(id, delay = this.undoWindowMs) {
    clearTimeout(this.purgeTimers.get(id));
    const timer = setTimeout(() => {
      this.purge(id).catch((error) => console.error('Failed to purge bookmark', error));
    }, delay);
    timer.unref?.();
    this.purgeTimers.set(id, timer);
  }

  async list() {
    await this.ready;
    return this.state.bookmarks
      .filter((bookmark) => !bookmark.deletedAt)
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((bookmark) => structuredClone(bookmark));
  }

  async create(input) {
    await this.ready;
    const parsed = parseWebAddress(input.url);
    const canonicalUrl = canonicalizeAddress(parsed.href);
    const existing = this.state.bookmarks.find((bookmark) => !bookmark.deletedAt && bookmark.canonicalUrl === canonicalUrl);
    if (existing) return { created: false, bookmark: structuredClone(existing) };

    const fallbackTitle = parsed.hostname.replace(/^www\./, '');
    const title = String(input.title ?? '').trim() || fallbackTitle;
    const bookmark = {
      id: randomUUID(),
      url: parsed.href,
      canonicalUrl,
      title,
      description: String(input.description ?? '').trim(),
      iconUrl: String(input.iconUrl ?? '').trim(),
      iconText: String(input.iconText ?? '').trim() || title.charAt(0).toUpperCase(),
      tags: normalizeTags(input.tags),
      createdAt: Date.now(),
      deletedAt: null
    };
    this.state.bookmarks.push(bookmark);
    await this.#persist();
    return { created: true, bookmark: structuredClone(bookmark) };
  }

  async updateTitle(id, title) {
    await this.ready;
    const bookmark = this.state.bookmarks.find((item) => item.id === id && !item.deletedAt);
    if (!bookmark) return null;
    const cleanTitle = String(title ?? '').trim();
    if (!cleanTitle) throw new Error('Enter a title');
    bookmark.title = cleanTitle;
    await this.#persist();
    return structuredClone(bookmark);
  }

  async remove(id) {
    await this.ready;
    const bookmark = this.state.bookmarks.find((item) => item.id === id && !item.deletedAt);
    if (!bookmark) return null;
    bookmark.deletedAt = Date.now();
    await this.#persist();
    this.#schedulePurge(id);
    return structuredClone(bookmark);
  }

  async restore(id) {
    await this.ready;
    const bookmark = this.state.bookmarks.find((item) => item.id === id && item.deletedAt);
    if (!bookmark || Date.now() - bookmark.deletedAt > this.undoWindowMs) return null;
    clearTimeout(this.purgeTimers.get(id));
    this.purgeTimers.delete(id);
    bookmark.deletedAt = null;
    await this.#persist();
    return structuredClone(bookmark);
  }

  async purge(id) {
    await this.ready;
    const before = this.state.bookmarks.length;
    this.state.bookmarks = this.state.bookmarks.filter((item) => item.id !== id || !item.deletedAt);
    this.purgeTimers.delete(id);
    if (before !== this.state.bookmarks.length) await this.#persist();
  }

  async tagSuggestions(query = '') {
    const bookmarks = await this.list();
    const counts = new Map();
    for (const bookmark of bookmarks) {
      for (const tag of bookmark.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
    const needle = String(query).trim().toLowerCase();
    return [...counts.entries()]
      .filter(([name]) => !needle || name.includes(needle))
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([name, uses]) => ({ name, uses }));
  }
}
