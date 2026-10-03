/**
 * URL validation and normalization for bookmarks.
 * A "valid web address" is an absolute http or https URL (spec Assumptions).
 */

export function isValidHttpUrl(value) {
  if (typeof value !== 'string' || value.trim() === '') return false;
  let parsed;
  try {
    parsed = new URL(value.trim());
  } catch {
    return false;
  }
  return parsed.protocol === 'http:' || parsed.protocol === 'https:';
}

/**
 * Normalize a URL for duplicate detection (research.md Decision 4):
 * lowercase scheme + host, drop default ports, drop a lone trailing slash,
 * preserve path and query, drop the fragment.
 * Throws if the value is not a valid http/https URL.
 */
export function normalizeUrl(value) {
  if (!isValidHttpUrl(value)) {
    throw new Error('invalid_url');
  }
  const u = new URL(value.trim());
  u.protocol = u.protocol.toLowerCase();
  u.hostname = u.hostname.toLowerCase();
  u.hash = '';
  // URL already strips default ports (80/443) from href.
  let out = u.href;
  // Remove a trailing slash when the path is just "/" and there is no query.
  if (u.pathname === '/' && u.search === '') {
    out = out.replace(/\/$/, '');
  }
  return out;
}

/**
 * Derive a human-friendly fallback title from a URL (FR-003).
 */
export function deriveTitleFromUrl(value) {
  try {
    const u = new URL(value);
    const path = u.pathname.replace(/\/+$/, '');
    if (path && path !== '') {
      const last = path.split('/').filter(Boolean).pop();
      if (last) return decodeURIComponent(last);
    }
    return u.hostname;
  } catch {
    return value;
  }
}
