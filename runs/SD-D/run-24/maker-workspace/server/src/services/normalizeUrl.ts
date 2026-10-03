// Light URL normalization for duplicate detection (spec Q1 / FR-006).
// Ignores scheme, a leading `www.`, host capitalization, a trailing slash, and
// common tracking parameters. Keeps the path and other query parameters
// significant, so distinct paths/queries remain separate bookmarks.

const TRACKING_PARAMS = [
  /^utm_/i, // utm_source, utm_medium, utm_campaign, ...
  /^fbclid$/i,
  /^gclid$/i,
  /^gbraid$/i,
  /^wbraid$/i,
  /^msclkid$/i,
  /^mc_eid$/i,
  /^mc_cid$/i,
  /^igshid$/i,
  /^ref$/i,
  /^ref_src$/i,
  /^_ga$/i,
];

function isTrackingParam(key: string): boolean {
  return TRACKING_PARAMS.some((re) => re.test(key));
}

export class InvalidUrlError extends Error {}

/** Returns true when the string is a well-formed http(s) web address. */
export function isValidWebUrl(input: string): boolean {
  try {
    const u = new URL(withScheme(input));
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

/** Add a scheme when the user omitted one (e.g. `example.com`). */
export function withScheme(input: string): string {
  const trimmed = input.trim();
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

/**
 * Compute the normalized form used as the duplicate-detection key.
 * Throws InvalidUrlError when the input is not a valid web address.
 */
export function normalizeUrl(input: string): string {
  if (!isValidWebUrl(input)) throw new InvalidUrlError(`Invalid URL: ${input}`);
  const u = new URL(withScheme(input));

  // Scheme is ignored: unify http/https by dropping it from the key.
  let host = u.hostname.toLowerCase();
  if (host.startsWith('www.')) host = host.slice(4);

  // Keep an explicit non-default port as significant.
  const port = u.port && u.port !== '80' && u.port !== '443' ? `:${u.port}` : '';

  // Path: drop a single trailing slash (but keep root as empty).
  let pathname = u.pathname;
  if (pathname.length > 1 && pathname.endsWith('/')) pathname = pathname.slice(0, -1);
  if (pathname === '/') pathname = '';

  // Query: drop tracking params, keep the rest, sorted for stability.
  const params = [...u.searchParams.entries()].filter(([k]) => !isTrackingParam(k));
  params.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const query = params.length
    ? '?' + params.map(([k, v]) => `${k}=${v}`).join('&')
    : '';

  // Fragments are not part of the identity of a page here.
  return `${host}${port}${pathname}${query}`;
}
