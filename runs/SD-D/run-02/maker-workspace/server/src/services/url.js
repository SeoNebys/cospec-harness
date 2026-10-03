// URL normalization + validation (research R11, FR-002/003).
// - add https:// when scheme missing
// - reject non-http/https
// - lower-case host, strip default ports and fragment, keep path/query
// - derive url_key used for duplicate detection

export class InvalidUrlError extends Error {
  constructor(message) {
    super(message);
    this.name = 'InvalidUrlError';
    this.code = 'invalid_url';
  }
}

export function normalizeUrl(input) {
  if (input == null || String(input).trim() === '') {
    throw new InvalidUrlError('A web address is required.');
  }
  let raw = String(input).trim();

  // Add scheme if missing (bare host like example.com). Reject other schemes.
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(raw)) {
    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(raw)) {
      // Has a scheme like mailto: / javascript: but not http(s)://
      throw new InvalidUrlError('Only http and https web addresses are supported.');
    }
    raw = 'https://' + raw;
  }

  let u;
  try {
    u = new URL(raw);
  } catch {
    throw new InvalidUrlError('That does not look like a valid web address.');
  }

  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    throw new InvalidUrlError('Only http and https web addresses are supported.');
  }
  if (!u.hostname) {
    throw new InvalidUrlError('That web address is missing a host.');
  }

  u.hostname = u.hostname.toLowerCase();
  u.hash = '';
  // Strip default ports.
  if ((u.protocol === 'http:' && u.port === '80') || (u.protocol === 'https:' && u.port === '443')) {
    u.port = '';
  }

  const url = u.toString();
  const urlKey = buildKey(u);
  return { url, urlKey };
}

function buildKey(u) {
  // Duplicate-detection key: scheme + host + path + sorted query, no fragment,
  // trailing slash on empty path normalized away.
  let path = u.pathname;
  if (path === '/') path = '';
  const params = [...u.searchParams.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const query = params.length ? '?' + params.map(([k, v]) => `${k}=${v}`).join('&') : '';
  return `${u.protocol}//${u.hostname}${u.port ? ':' + u.port : ''}${path}${query}`;
}
