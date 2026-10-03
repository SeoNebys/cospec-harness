// Shared URL normalization + validation (FR-002, FR-003).
// Used by the API layer and the test suite so both agree on the rules.

const ALLOWED_SCHEMES = new Set(['http:', 'https:']);

/**
 * Normalize a user-entered address and validate it.
 * - Trims surrounding whitespace.
 * - Prepends `https://` when no scheme is present (FR-003).
 * - Accepts only http/https (FR-002).
 *
 * @param {string} input
 * @returns {string} the normalized absolute URL
 * @throws {Error} with `.code = 'INVALID_URL'` when the input is not a usable address
 */
export function normalizeUrl(input) {
  if (typeof input !== 'string' || input.trim() === '') {
    throw invalid();
  }

  let candidate = input.trim();

  // If there is no scheme (e.g. "example.com"), assume a secure one.
  // A leading "//" is also treated as scheme-relative and given https.
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(candidate)) {
    candidate = 'https://' + candidate.replace(/^\/+/, '');
  }

  let parsed;
  try {
    parsed = new URL(candidate);
  } catch {
    throw invalid();
  }

  if (!ALLOWED_SCHEMES.has(parsed.protocol)) {
    throw invalid();
  }

  // A hostname is required for an http(s) URL to be meaningful.
  if (!parsed.hostname) {
    throw invalid();
  }

  return parsed.toString();
}

/**
 * Derive a human-friendly fallback label from a URL (host + path), used when a
 * bookmark has no title (FR-004).
 * @param {string} url a normalized absolute URL
 * @returns {string}
 */
export function labelFromUrl(url) {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname === '/' ? '' : parsed.pathname;
    return (parsed.host + path + parsed.search).replace(/\/$/, '') || parsed.host;
  } catch {
    return url;
  }
}

function invalid() {
  const err = new Error('Invalid URL');
  err.code = 'INVALID_URL';
  return err;
}
