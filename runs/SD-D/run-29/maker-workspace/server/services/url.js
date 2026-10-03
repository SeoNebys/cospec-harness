// URL normalization + duplicate matching, and fallback title derivation.
// Normalization rules (research §9): add https:// if scheme missing, lowercase
// host, strip default ports, drop trailing slash on root, preserve path/query/
// fragment otherwise.

export class ValidationError extends Error {}

export function normalize(input) {
  if (input == null) throw new ValidationError('Address is required.');
  let raw = String(input).trim();
  if (!raw) throw new ValidationError('Address is required.');

  // Add a scheme if the user typed a bare host like "example.com".
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(raw)) {
    raw = 'https://' + raw;
  }

  let u;
  try {
    u = new URL(raw);
  } catch {
    throw new ValidationError('That does not look like a valid web address.');
  }

  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    throw new ValidationError('Only http and https addresses are supported.');
  }
  if (!u.hostname) {
    throw new ValidationError('That does not look like a valid web address.');
  }

  u.hostname = u.hostname.toLowerCase();

  // Remove default ports.
  if ((u.protocol === 'http:' && u.port === '80') ||
      (u.protocol === 'https:' && u.port === '443')) {
    u.port = '';
  }

  // Drop a trailing slash (trivial variant per the duplicate rule) when there is
  // no query/fragment: "/foo/" and "/foo" — and bare "/" — collapse to the same.
  let normalized = u.toString();
  if (!u.search && !u.hash && normalized.endsWith('/')) {
    normalized = normalized.replace(/\/+$/, '');
  }
  return normalized;
}

// Human-readable fallback title from a normalized URL (host + trimmed path).
export function deriveTitle(normalizedUrl) {
  try {
    const u = new URL(normalizedUrl);
    const path = u.pathname.replace(/\/$/, '');
    if (path && path !== '/') {
      const last = path.split('/').filter(Boolean).pop() || '';
      const cleaned = decodeURIComponent(last)
        .replace(/[-_]+/g, ' ')
        .replace(/\.\w+$/, '')
        .trim();
      if (cleaned) return `${cleaned} — ${u.hostname}`;
    }
    return u.hostname;
  } catch {
    return normalizedUrl;
  }
}
