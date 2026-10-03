import { LIMITS } from '../types/bookmark.ts';

export class UrlValidationError extends Error {}

export function normalizeBookmarkUrl(input: string) {
  let raw = input.trim();
  if (!raw) throw new UrlValidationError('Enter a web address.');
  if (raw.length > LIMITS.url) throw new UrlValidationError(`Web addresses must be ${LIMITS.url} characters or fewer.`);
  if (!/^https?:\/\//i.test(raw) && !/^[a-z][a-z\d+.-]*:\/\//i.test(raw)) raw = `https://${raw}`;
  let url: URL;
  try { url = new URL(raw); } catch { throw new UrlValidationError('Enter a valid web address.'); }
  if (!['http:', 'https:'].includes(url.protocol)) throw new UrlValidationError('Only HTTP and HTTPS web addresses can be saved.');
  if (url.username || url.password) throw new UrlValidationError('Web addresses containing credentials cannot be saved.');
  if (!url.hostname || (!url.hostname.includes('.') && url.hostname !== 'localhost')) throw new UrlValidationError('Enter a complete website address.');
  const serialized = url.toString();
  return { url: serialized, canonicalUrl: serialized };
}

export function normalizeText(value: string) { return value.normalize('NFKC').trim().replace(/\s+/gu, ' '); }
export function comparisonText(value: string) { return normalizeText(value).toLocaleLowerCase('und'); }
