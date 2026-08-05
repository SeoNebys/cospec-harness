// URL normalization, validation, and duplicate-key derivation.
// Traces to research.md §6, FR-002, FR-023, SC-007.

export class InvalidUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidUrlError';
  }
}

/**
 * Validate and normalize a user-entered address into a canonical display URL.
 * - Adds `https://` when the scheme is omitted (e.g. `example.com`).
 * - Only http/https are accepted; anything else is rejected (FR-002).
 * Throws InvalidUrlError on malformed input.
 */
export function normalizeUrl(raw: string): string {
  const trimmed = (raw ?? '').trim();
  if (!trimmed) throw new InvalidUrlError('Please enter a web address.');

  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  let parsed: URL;
  try {
    parsed = new URL(withScheme);
  } catch {
    throw new InvalidUrlError(`"${raw}" is not a valid web address.`);
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new InvalidUrlError('Only http and https addresses are supported.');
  }
  if (!parsed.hostname || !parsed.hostname.includes('.')) {
    throw new InvalidUrlError(`"${raw}" is not a valid web address.`);
  }

  // Canonical display form: lowercase host, no trailing slash on an empty path.
  parsed.hostname = parsed.hostname.toLowerCase();
  return parsed.toString();
}

/**
 * Derive the duplicate key used to decide whether two addresses are "the same"
 * (FR-023). Boils an address down to: lowercase scheme + host, no default port,
 * path without a trailing slash, no #fragment. Query strings are preserved (they
 * often identify distinct pages — research §6). Assumes an already-normalized URL.
 */
export function urlKey(normalized: string): string {
  const u = new URL(normalized);
  const scheme = u.protocol.toLowerCase();
  const host = u.hostname.toLowerCase();
  const isDefaultPort =
    (scheme === 'https:' && u.port === '443') || (scheme === 'http:' && u.port === '80');
  const port = u.port && !isDefaultPort ? `:${u.port}` : '';
  const path = u.pathname === '/' ? '' : u.pathname.replace(/\/+$/, '');
  return `${scheme}//${host}${port}${path}${u.search}`;
}

/** Convenience: normalize then derive the key in one step. */
export function normalizeAndKey(raw: string): { url: string; key: string } {
  const url = normalizeUrl(raw);
  return { url, key: urlKey(url) };
}
