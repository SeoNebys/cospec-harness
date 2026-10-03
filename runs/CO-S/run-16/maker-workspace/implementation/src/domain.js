import { randomUUID } from 'node:crypto';

export const PAGE_SIZE = 20;

export function parseWebUrl(value) {
  if (typeof value !== 'string' || value.trim() === '') return null;
  try {
    const parsed = new URL(value.trim());
    if (!['http:', 'https:'].includes(parsed.protocol) || !parsed.hostname) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function normalizeUrl(value) {
  const parsed = parseWebUrl(value);
  if (!parsed) return null;
  parsed.hash = '';
  parsed.hostname = parsed.hostname.toLowerCase();
  if ((parsed.protocol === 'https:' && parsed.port === '443') || (parsed.protocol === 'http:' && parsed.port === '80')) {
    parsed.port = '';
  }
  if (parsed.pathname === '/') parsed.pathname = '';
  return parsed.toString();
}

export function createBookmark(url, metadata = null, now = new Date()) {
  const parsed = parseWebUrl(url);
  if (!parsed) throw new TypeError('A complete HTTP or HTTPS address is required.');
  const normalizedUrl = normalizeUrl(url);
  const captured = metadata && metadata.title;
  return {
    id: randomUUID(),
    url: parsed.toString(),
    normalizedUrl,
    source: parsed.hostname.replace(/^www\./, ''),
    title: captured ? metadata.title : 'Untitled bookmark',
    description: captured ? metadata.description || 'No description was provided by this page.' : parsed.toString(),
    image: captured ? metadata.image || '' : '',
    readingMinutes: captured ? metadata.readingMinutes || 1 : null,
    capturedAt: now.toISOString(),
    updatedAt: now.toISOString(),
    isBasic: !captured,
    manualTitle: false,
    tags: [],
    note: '',
    readLater: false,
    archived: false
  };
}

export function findDuplicate(bookmarks, url) {
  const normalized = normalizeUrl(url);
  if (!normalized) return null;
  return bookmarks.find(bookmark => bookmark.normalizedUrl === normalized) || null;
}

export function canonicalTag(bookmarks, enteredTag) {
  const cleaned = typeof enteredTag === 'string' ? enteredTag.trim().replace(/\s+/g, ' ') : '';
  if (!cleaned) return '';
  return bookmarks.flatMap(bookmark => bookmark.tags)
    .find(tag => tag.toLocaleLowerCase() === cleaned.toLocaleLowerCase()) || cleaned;
}

export function addTag(bookmarks, bookmarkId, enteredTag) {
  const tag = canonicalTag(bookmarks, enteredTag);
  const bookmark = bookmarks.find(item => item.id === bookmarkId);
  if (!bookmark || !tag) return { bookmark, tag, added: false, reused: false };
  const alreadyAssigned = bookmark.tags.some(item => item.toLocaleLowerCase() === tag.toLocaleLowerCase());
  if (!alreadyAssigned) bookmark.tags.push(tag);
  const reused = tag.toLocaleLowerCase() === enteredTag.trim().toLocaleLowerCase() && tag !== enteredTag.trim();
  return { bookmark, tag, added: !alreadyAssigned, reused };
}

export function searchAndFilter(bookmarks, { query = '', tag = '', view = 'all' } = {}) {
  const term = query.trim().toLocaleLowerCase();
  return bookmarks.filter(bookmark => {
    const inView = view === 'archive' ? bookmark.archived
      : view === 'read-later' ? bookmark.readLater && !bookmark.archived
        : !bookmark.archived;
    if (!inView) return false;
    if (tag && !bookmark.tags.includes(tag)) return false;
    if (!term) return true;
    return [bookmark.title, bookmark.source, bookmark.description, bookmark.note]
      .some(value => String(value || '').toLocaleLowerCase().includes(term));
  });
}

export function paginate(items, page = 1, pageSize = PAGE_SIZE) {
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const currentPage = Math.min(Math.max(Number(page) || 1, 1), pageCount);
  const start = (currentPage - 1) * pageSize;
  return {
    items: items.slice(start, start + pageSize),
    currentPage,
    pageCount,
    total: items.length
  };
}

export function tagCounts(bookmarks) {
  const counts = new Map();
  for (const bookmark of bookmarks.filter(item => !item.archived)) {
    for (const tag of bookmark.tags) counts.set(tag, (counts.get(tag) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
