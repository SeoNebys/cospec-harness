import { randomUUID } from 'node:crypto';

export const TRACKING_PARAMS = new Set([
  'fbclid', 'gclid', 'dclid', 'mc_cid', 'mc_eid', 'igshid', 'mkt_tok',
  'ref_src', 'ref_url', '_hsenc', '_hsmi'
]);

export function parseHttpUrl(input) {
  const value = String(input ?? '').trim();
  let url;
  try { url = new URL(value); } catch { throw new Error('Enter a complete web address, such as https://example.com/article'); }
  if (!['http:', 'https:'].includes(url.protocol) || !url.hostname) {
    throw new Error('Enter a complete web address, such as https://example.com/article');
  }
  return url;
}

export function normalizeUrl(input) {
  const url = parseHttpUrl(input);
  url.hash = '';
  url.hostname = url.hostname.toLowerCase();
  for (const key of [...url.searchParams.keys()]) {
    if (key.toLowerCase().startsWith('utm_') || TRACKING_PARAMS.has(key.toLowerCase())) url.searchParams.delete(key);
  }
  [...url.searchParams.entries()].sort(([a, av], [b, bv]) => a.localeCompare(b) || av.localeCompare(bv)).forEach(([k]) => url.searchParams.delete(k));
  const entries = [...new URL(input).searchParams.entries()].filter(([key]) => !(key.toLowerCase().startsWith('utm_') || TRACKING_PARAMS.has(key.toLowerCase()))).sort(([a, av], [b, bv]) => a.localeCompare(b) || av.localeCompare(bv));
  for (const [key, value] of entries) url.searchParams.append(key, value);
  if (url.pathname !== '/') url.pathname = url.pathname.replace(/\/+$/, '');
  return url.toString();
}

export function sourceFor(input) {
  return parseHttpUrl(input).hostname.replace(/^www\./i, '');
}

export function cleanLabels(labels = []) {
  const map = new Map();
  for (const raw of labels) {
    const label = String(raw ?? '').trim().replace(/\s+/g, ' ');
    if (label && !map.has(label.toLocaleLowerCase())) map.set(label.toLocaleLowerCase(), label);
  }
  return [...map.values()];
}

export function makeBookmark({ url, title, description = '', favicon = '', labels = [], readLater = false, createdAt = new Date().toISOString(), dateKnown = true, capture = null }) {
  const parsed = parseHttpUrl(url);
  return {
    id: randomUUID(), url: parsed.toString(), normalizedUrl: normalizeUrl(url),
    title: String(title || parsed.hostname), description: String(description || ''),
    source: sourceFor(url), favicon: String(favicon || ''), labels: cleanLabels(labels),
    readLater: Boolean(readLater), putAway: false, createdAt: dateKnown ? createdAt : null,
    dateKnown: Boolean(dateKnown), capture, detailsStatus: capture?.status === 'failed' ? 'needs-retry' : 'ready'
  };
}

export function matchesBookmark(bookmark, filters = {}) {
  const text = String(filters.text || '').trim().toLocaleLowerCase();
  const exact = String(filters.exact || '').trim().toLocaleLowerCase();
  const haystack = `${bookmark.title} ${bookmark.description} ${bookmark.url}`.toLocaleLowerCase();
  if (text && !text.split(/\s+/).every(word => haystack.includes(word))) return false;
  if (exact && !haystack.includes(exact)) return false;
  if (filters.excludeSite && bookmark.source.toLocaleLowerCase().includes(String(filters.excludeSite).trim().toLocaleLowerCase())) return false;
  const selected = cleanLabels(filters.labels || []).map(label => label.toLocaleLowerCase());
  const owned = bookmark.labels.map(label => label.toLocaleLowerCase());
  if (selected.length) {
    const ok = filters.labelMode === 'all' ? selected.every(label => owned.includes(label)) : selected.some(label => owned.includes(label));
    if (!ok) return false;
  }
  return true;
}

export function filterBookmarks(bookmarks, { view = 'all', ...filters } = {}) {
  return bookmarks.filter(bookmark => {
    if (view === 'put-away') return bookmark.putAway && matchesBookmark(bookmark, filters);
    if (bookmark.putAway) return false;
    if (view === 'read-later' && !bookmark.readLater) return false;
    return matchesBookmark(bookmark, filters);
  });
}

export function sortBookmarks(bookmarks, order = 'newest') {
  return [...bookmarks].sort((a, b) => {
    if (order === 'name') return a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });
    const known = Number(Boolean(b.dateKnown)) - Number(Boolean(a.dateKnown));
    if (known) return known;
    if (!a.dateKnown && !b.dateKnown) return a.title.localeCompare(b.title);
    const delta = new Date(a.createdAt) - new Date(b.createdAt);
    return order === 'oldest' ? delta : -delta;
  });
}

export function applyBulk(bookmarks, ids, action, value) {
  const selected = new Set(ids);
  if (action === 'delete') return bookmarks.filter(bookmark => !selected.has(bookmark.id));
  return bookmarks.map(bookmark => {
    if (!selected.has(bookmark.id)) return bookmark;
    if (action === 'read') return { ...bookmark, readLater: false };
    if (action === 'unread') return { ...bookmark, readLater: true };
    if (action === 'put-away') return { ...bookmark, putAway: true };
    if (action === 'restore') return { ...bookmark, putAway: false };
    if (action === 'add-label') return { ...bookmark, labels: cleanLabels([...bookmark.labels, value]) };
    if (action === 'remove-label') return { ...bookmark, labels: bookmark.labels.filter(label => label.toLocaleLowerCase() !== String(value).toLocaleLowerCase()) };
    return bookmark;
  });
}
