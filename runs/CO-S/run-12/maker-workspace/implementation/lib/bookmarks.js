import { randomUUID } from 'node:crypto';

export function normalizeUrl(value) {
  const raw = String(value ?? '').trim();
  if (!raw) throw new Error('Enter a web address.');
  let parsed;
  try { parsed = new URL(raw); } catch { throw new Error('Enter a web address, like https://example.com/page'); }
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Only http and https web addresses can be saved.');
  parsed.hash = '';
  parsed.hostname = parsed.hostname.toLowerCase();
  if (parsed.pathname !== '/') parsed.pathname = parsed.pathname.replace(/\/+$/, '');
  return parsed.toString();
}

export function normalizeTag(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ').toLocaleLowerCase();
}

export function publicBookmark(input, now = new Date().toISOString()) {
  return {
    id: input.id ?? randomUUID(),
    url: normalizeUrl(input.url),
    title: String(input.title ?? '').trim(),
    description: String(input.description ?? '').trim(),
    image: String(input.image ?? '').trim(),
    icon: String(input.icon ?? '').trim(),
    site: String(input.site ?? '').trim(),
    notes: String(input.notes ?? '').trim(),
    tags: [...new Set((input.tags ?? []).map(normalizeTag).filter(Boolean))],
    readLater: Boolean(input.readLater),
    archived: Boolean(input.archived),
    createdAt: input.createdAt ?? now,
    updatedAt: now
  };
}

export function matchesSearch(bookmark, query) {
  const words = String(query ?? '').trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const fields = [bookmark.title, bookmark.description, bookmark.notes].map(value => String(value ?? '').toLocaleLowerCase());
  return words.every(word => fields.some(field => field.includes(word)));
}
