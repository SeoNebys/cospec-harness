// Address normalisation and duplicate detection (FR-006, US2).
// Produces a canonical key so trivial variants map to one bookmark.

const TRACKING_PARAM_PATTERNS = [
  /^utm_/i,
  /^fbclid$/i,
  /^gclid$/i,
  /^mc_/i,
  /^ref$/i,
  /^ref_src$/i,
];

const DEFAULT_PORTS = { 'http:': '80', 'https:': '443' };

/** Return true if the string is a well-formed http(s) URL (FR-005). */
export function isValidHttpUrl(raw) {
  if (typeof raw !== 'string' || raw.trim() === '') return false;
  let u;
  try {
    u = new URL(raw.trim());
  } catch {
    return false;
  }
  return u.protocol === 'http:' || u.protocol === 'https:';
}

/**
 * Canonicalise a URL for duplicate detection:
 * - lowercase scheme + host
 * - strip default ports
 * - remove a single trailing slash on the path
 * - drop common tracking query params
 * - sort remaining query params
 * Throws if the URL is not a valid http(s) address.
 */
export function canonicalKey(raw) {
  if (!isValidHttpUrl(raw)) {
    throw new Error('Invalid URL');
  }
  const u = new URL(raw.trim());

  const scheme = u.protocol.toLowerCase();
  const host = u.hostname.toLowerCase();
  const port =
    u.port && u.port !== DEFAULT_PORTS[scheme] ? `:${u.port}` : '';

  // Path: strip a single trailing slash (but keep root "/").
  let pathName = u.pathname;
  if (pathName.length > 1 && pathName.endsWith('/')) {
    pathName = pathName.slice(0, -1);
  }

  // Query: drop tracking params, sort the rest.
  const params = [...u.searchParams.entries()].filter(
    ([key]) => !TRACKING_PARAM_PATTERNS.some((re) => re.test(key))
  );
  params.sort((a, b) =>
    a[0] === b[0] ? a[1].localeCompare(b[1]) : a[0].localeCompare(b[0])
  );
  const query =
    params.length > 0
      ? '?' + params.map(([k, v]) => `${k}=${v}`).join('&')
      : '';

  return `${scheme}//${host}${port}${pathName}${query}`;
}

/** Derive a readable title from a URL when metadata gives none (FR-004). */
export function deriveTitleFromUrl(raw) {
  try {
    const u = new URL(raw.trim());
    const segs = u.pathname.split('/').filter(Boolean);
    if (segs.length > 0) {
      const last = decodeURIComponent(segs[segs.length - 1])
        .replace(/[-_]+/g, ' ')
        .replace(/\.[a-z0-9]+$/i, '')
        .trim();
      if (last) return `${last} — ${u.hostname}`;
    }
    return u.hostname;
  } catch {
    return raw;
  }
}
