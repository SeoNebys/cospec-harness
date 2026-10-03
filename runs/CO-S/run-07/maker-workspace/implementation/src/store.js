const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

class StoreError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'StoreError';
    this.code = code;
    Object.assign(this, details);
  }
}

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normaliseUrl(value) {
  const raw = cleanText(value);
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    throw new StoreError('INVALID_URL', 'Enter a full web address beginning with http:// or https://');
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new StoreError('INVALID_URL', 'Enter a full web address beginning with http:// or https://');
  }
  if (parsed.pathname.length > 1) parsed.pathname = parsed.pathname.replace(/\/+$/, '');
  return parsed.href;
}

function cleanTags(values) {
  if (!Array.isArray(values)) return [];
  const seen = new Set();
  const tags = [];
  for (const value of values) {
    const tag = cleanText(value);
    const key = tag.toLocaleLowerCase();
    if (!tag || seen.has(key)) continue;
    seen.add(key);
    tags.push(tag);
  }
  return tags;
}

function validateBookmark(input) {
  const title = cleanText(input.title);
  if (!title) throw new StoreError('INVALID_TITLE', 'Enter a title so you can recognise this bookmark.');
  return {
    url: normaliseUrl(input.url),
    title,
    description: cleanText(input.description),
    tags: cleanTags(input.tags),
    isReadLater: Boolean(input.isReadLater),
  };
}

class BookmarkStore {
  constructor(filePath, { now = () => new Date().toISOString() } = {}) {
    this.filePath = filePath;
    this.now = now;
    this.state = { bookmarks: [] };
    this.load();
  }

  load() {
    if (!this.filePath || !fs.existsSync(this.filePath)) return;
    const parsed = JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
    if (!parsed || !Array.isArray(parsed.bookmarks)) throw new Error('Bookmark data file is malformed');
    this.state = parsed;
  }

  persist() {
    if (!this.filePath) return;
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    const tempPath = `${this.filePath}.${process.pid}.${crypto.randomUUID()}.tmp`;
    fs.writeFileSync(tempPath, `${JSON.stringify(this.state, null, 2)}\n`, 'utf8');
    fs.renameSync(tempPath, this.filePath);
  }

  list() {
    return [...this.state.bookmarks].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  find(id) {
    return this.state.bookmarks.find((bookmark) => bookmark.id === id) || null;
  }

  findByUrl(url, exceptId = null) {
    const normalised = normaliseUrl(url);
    return this.state.bookmarks.find((bookmark) => bookmark.id !== exceptId && bookmark.url === normalised) || null;
  }

  canonicaliseTags(tags) {
    const existing = new Map();
    for (const bookmark of this.state.bookmarks) {
      for (const tag of bookmark.tags) if (!existing.has(tag.toLocaleLowerCase())) existing.set(tag.toLocaleLowerCase(), tag);
    }
    return tags.map((tag) => existing.get(tag.toLocaleLowerCase()) || tag);
  }

  create(input) {
    const data = validateBookmark(input);
    data.tags = this.canonicaliseTags(data.tags);
    const existing = this.findByUrl(data.url);
    if (existing) throw new StoreError('DUPLICATE', 'This address is already in your library.', { existing });
    const timestamp = this.now();
    const bookmark = {
      id: crypto.randomUUID(),
      ...data,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    this.state.bookmarks.push(bookmark);
    this.persist();
    return bookmark;
  }

  update(id, input) {
    const index = this.state.bookmarks.findIndex((bookmark) => bookmark.id === id);
    if (index < 0) throw new StoreError('NOT_FOUND', 'Bookmark not found.');
    const data = validateBookmark(input);
    data.tags = this.canonicaliseTags(data.tags);
    const existing = this.findByUrl(data.url, id);
    if (existing) throw new StoreError('DUPLICATE', 'This address is already in your library.', { existing });
    const current = this.state.bookmarks[index];
    const bookmark = { ...current, ...data, createdAt: current.createdAt, updatedAt: this.now() };
    this.state.bookmarks[index] = bookmark;
    this.persist();
    return bookmark;
  }

  setReadLater(id, isReadLater) {
    const bookmark = this.find(id);
    if (!bookmark) throw new StoreError('NOT_FOUND', 'Bookmark not found.');
    bookmark.isReadLater = Boolean(isReadLater);
    bookmark.updatedAt = this.now();
    this.persist();
    return bookmark;
  }

  remove(id) {
    const index = this.state.bookmarks.findIndex((bookmark) => bookmark.id === id);
    if (index < 0) throw new StoreError('NOT_FOUND', 'Bookmark not found.');
    const [removed] = this.state.bookmarks.splice(index, 1);
    this.persist();
    return removed;
  }
}

module.exports = { BookmarkStore, StoreError, normaliseUrl, validateBookmark, cleanTags };
