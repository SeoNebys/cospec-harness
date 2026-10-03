import { badRequest } from './errors.ts';

export interface NormalizedUrl {
  url: string; // normalized, canonical form stored as `url`
  key: string; // duplicate-detection key
}

/**
 * Normalize a user-entered address and derive a duplicate-detection key.
 * Rules (spec FR-004/FR-008, research.md §8):
 *  - reject whitespace-only / empty input
 *  - add http:// when the scheme is missing
 *  - only http/https are accepted
 *  - key lowercases scheme + host, drops a single trailing slash on the path,
 *    and preserves the rest (path case, query, fragment kept on `url`).
 */
export function normalizeUrl(input: string): NormalizedUrl {
  const trimmed = (input ?? '').trim();
  if (!trimmed) throw badRequest('Address is required.');

  let candidate = trimmed;
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(candidate)) {
    candidate = `http://${candidate}`;
  }

  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    throw badRequest(`"${input}" is not a valid web address.`);
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw badRequest('Only http and https addresses are supported.');
  }
  if (!parsed.hostname) {
    throw badRequest(`"${input}" is not a valid web address.`);
  }

  // Canonical url: lowercased scheme + host, original path/query/fragment.
  parsed.protocol = parsed.protocol.toLowerCase();
  parsed.hostname = parsed.hostname.toLowerCase();
  const url = parsed.toString();

  // Key: strip a single trailing slash on the path (but keep root "/").
  const keyUrl = new URL(url);
  if (keyUrl.pathname.length > 1 && keyUrl.pathname.endsWith('/')) {
    keyUrl.pathname = keyUrl.pathname.replace(/\/+$/, '');
  }
  // Normalize an empty/root path to '' so http://a and http://a/ match.
  const path = keyUrl.pathname === '/' ? '' : keyUrl.pathname;
  const key = `${keyUrl.protocol}//${keyUrl.host}${path}${keyUrl.search}${keyUrl.hash}`;

  return { url, key };
}

/** Derive a human title from a URL when none is available. */
export function deriveTitleFromUrl(url: string): string {
  try {
    const u = new URL(url);
    const path = u.pathname.replace(/\/+$/, '');
    return path && path !== '' ? `${u.hostname}${path}` : u.hostname;
  } catch {
    return url;
  }
}
