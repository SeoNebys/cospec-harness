import { randomUUID } from 'node:crypto';
import { fetchPageMetadata } from './metadata.js';

const trackingNames = new Set(['fbclid', 'gclid', 'dclid', 'msclkid', 'mc_cid', 'mc_eid', 'igshid', 'ref_src']);

export class BookmarkError extends Error {
  constructor(message, status = 400, code = 'BAD_REQUEST') {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function validateUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new BookmarkError('Please enter a complete web address, such as https://example.com/article.', 400, 'INVALID_URL');
  }
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new BookmarkError('Please enter an http or https web address.', 400, 'INVALID_URL');
  }
  return url;
}

export function canonicalizeUrl(value) {
  const url = validateUrl(value);
  url.hash = '';
  for (const name of [...url.searchParams.keys()]) {
    if (name.toLowerCase().startsWith('utm_') || trackingNames.has(name.toLowerCase())) url.searchParams.delete(name);
  }
  url.searchParams.sort();
  url.hostname = url.hostname.toLowerCase();
  if (url.pathname.length > 1 && url.pathname.endsWith('/')) url.pathname = url.pathname.slice(0, -1);
  return url.href.replace(/\?$/, '');
}

export function normalizeLabels(labels = []) {
  const normalized = [];
  for (const raw of labels) {
    const label = String(raw).trim();
    if (!label) continue;
    if (!normalized.some((existing) => existing.toLowerCase() === label.toLowerCase())) normalized.push(label);
  }
  return normalized;
}

function fallbackDetails(url) {
  const parsed = new URL(url);
  const site = parsed.hostname.replace(/^www\./, '');
  return { title: site, description: '', site, icon: '' };
}

export class BookmarkService {
  constructor(store, metadataFetcher = fetchPageMetadata) {
    this.store = store;
    this.metadataFetcher = metadataFetcher;
  }

  async state() {
    const bookmarks = await this.store.all();
    const labels = normalizeLabels(bookmarks.flatMap((bookmark) => bookmark.labels || []))
      .sort((left, right) => left.localeCompare(right));
    return { bookmarks, labels };
  }

  async add(value) {
    const parsed = validateUrl(value);
    const url = parsed.href;
    const canonicalUrl = canonicalizeUrl(url);
    const bookmarks = await this.store.all();
    const duplicate = bookmarks.find((bookmark) => bookmark.canonicalUrl === canonicalUrl);
    if (duplicate) return { bookmark: duplicate, duplicate: true };

    let details;
    let metadataStatus = 'complete';
    try {
      details = await this.metadataFetcher(url);
      if (!details.title) details.title = fallbackDetails(url).title;
    } catch {
      details = fallbackDetails(url);
      metadataStatus = 'failed';
    }

    const timestamp = new Date().toISOString();
    const bookmark = {
      id: randomUUID(), url, canonicalUrl,
      title: details.title,
      description: details.description || '',
      site: details.site || fallbackDetails(url).site,
      icon: details.icon || '',
      labels: [], readLater: false, archived: false, metadataStatus,
      createdAt: timestamp, updatedAt: timestamp
    };
    bookmarks.unshift(bookmark);
    await this.store.replace(bookmarks);
    return { bookmark, duplicate: false };
  }

  async update(id, changes) {
    const bookmarks = await this.store.all();
    const bookmark = bookmarks.find((item) => item.id === id);
    if (!bookmark) throw new BookmarkError('Bookmark not found.', 404, 'NOT_FOUND');
    if (Object.hasOwn(changes, 'title')) bookmark.title = String(changes.title).trim() || bookmark.site;
    if (Object.hasOwn(changes, 'description')) bookmark.description = String(changes.description).trim();
    if (Object.hasOwn(changes, 'labels')) bookmark.labels = normalizeLabels(changes.labels);
    if (Object.hasOwn(changes, 'readLater')) bookmark.readLater = Boolean(changes.readLater);
    if (Object.hasOwn(changes, 'archived')) {
      bookmark.archived = Boolean(changes.archived);
      if (bookmark.archived) bookmark.readLater = false;
    }
    bookmark.updatedAt = new Date().toISOString();
    await this.store.replace(bookmarks);
    return bookmark;
  }

  async retryMetadata(id) {
    const bookmarks = await this.store.all();
    const bookmark = bookmarks.find((item) => item.id === id);
    if (!bookmark) throw new BookmarkError('Bookmark not found.', 404, 'NOT_FOUND');
    try {
      const details = await this.metadataFetcher(bookmark.url);
      bookmark.title = details.title || bookmark.title;
      bookmark.description = details.description || bookmark.description;
      bookmark.site = details.site || bookmark.site;
      bookmark.icon = details.icon || bookmark.icon;
      bookmark.metadataStatus = 'complete';
    } catch {
      bookmark.metadataStatus = 'failed';
    }
    bookmark.updatedAt = new Date().toISOString();
    await this.store.replace(bookmarks);
    return bookmark;
  }

  async delete(id) {
    const bookmarks = await this.store.all();
    const index = bookmarks.findIndex((item) => item.id === id);
    if (index === -1) throw new BookmarkError('Bookmark not found.', 404, 'NOT_FOUND');
    const [deleted] = bookmarks.splice(index, 1);
    await this.store.replace(bookmarks);
    return deleted;
  }
}
