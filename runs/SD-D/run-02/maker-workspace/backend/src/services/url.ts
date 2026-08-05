/**
 * URL validation, normalization, and helpers (FR-005/006).
 * - Accepts scheme-less input ("example.com") and normalizes to https.
 * - Rejects non-http(s) and malformed input.
 * - Produces a canonical `normalized` form for duplicate detection.
 * - Derives a fallback title from the URL when metadata can't be fetched (FR-004).
 */

const TRACKING_PARAMS = new Set([
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
  'gclid', 'fbclid', 'mc_cid', 'mc_eid', 'ref', 'ref_src',
]);

export interface NormalizedUrl {
  /** The cleaned, canonical URL to store as `url`. */
  href: string;
  /** The canonical key used for duplicate detection. */
  normalized: string;
}

export class InvalidUrlError extends Error {}

export function normalizeUrl(input: string): NormalizedUrl {
  const raw = (input ?? '').trim();
  if (!raw) throw new InvalidUrlError('Please enter a web address.');

  // Add a scheme if the user omitted one (e.g. "example.com").
  const withScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(raw) ? raw : `https://${raw}`;

  let u: URL;
  try {
    u = new URL(withScheme);
  } catch {
    throw new InvalidUrlError(`"${input}" is not a valid web address.`);
  }

  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    throw new InvalidUrlError('Only http and https web addresses are supported.');
  }
  if (!u.hostname || !u.hostname.includes('.')) {
    throw new InvalidUrlError(`"${input}" is not a valid web address.`);
  }

  // The stored href keeps the user's scheme/query but with a valid structure.
  const href = u.toString();

  // Build the canonical form for dedupe.
  const canonical = new URL(u.toString());
  canonical.protocol = 'https:'; // treat http/https as the same resource
  canonical.hostname = canonical.hostname.toLowerCase().replace(/^www\./, '');
  canonical.hash = '';
  // Drop default ports.
  if (canonical.port === '80' || canonical.port === '443') canonical.port = '';
  // Strip tracking params, then sort the rest for stable comparison.
  const params = [...canonical.searchParams.entries()]
    .filter(([k]) => !TRACKING_PARAMS.has(k.toLowerCase()))
    .sort(([a], [b]) => a.localeCompare(b));
  canonical.search = '';
  for (const [k, v] of params) canonical.searchParams.append(k, v);
  // Normalize trailing slash on the path.
  let path = canonical.pathname;
  if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1);
  canonical.pathname = path;

  return { href, normalized: canonical.toString() };
}

/** A human-friendly fallback title derived from the address (FR-004). */
export function fallbackTitle(href: string): string {
  try {
    const u = new URL(href);
    const path = u.pathname.replace(/\/$/, '');
    return path && path !== '/' ? `${u.hostname}${path}` : u.hostname;
  } catch {
    return href;
  }
}

export function looksLikePdf(href: string): boolean {
  try {
    return new URL(href).pathname.toLowerCase().endsWith('.pdf');
  } catch {
    return false;
  }
}
