// URL normalization + validation (research Decision 9, FR-004/005).
// - add missing scheme (default https://)
// - lower-case host
// - strip trailing slash on empty path
// - strip default port
// - keep path/query case-sensitive

const DEFAULT_PORTS = { 'http:': '80', 'https:': '443' };

function withScheme(raw) {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return trimmed;
  // If it already has a scheme like http:, https:, ftp:, keep it.
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) return trimmed;
  // Reject things that look like they already have a non-web scheme (mailto:, javascript:)
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed) && !/^https?:/i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export function isValidWebUrl(raw) {
  const candidate = withScheme(raw);
  let u;
  try {
    u = new URL(candidate);
  } catch {
    return false;
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
  if (!u.hostname) return false;
  // Require a dot in the hostname or localhost, to reject bare words like "notaurl".
  if (u.hostname !== 'localhost' && !u.hostname.includes('.')) return false;
  return true;
}

export function normalize(raw) {
  if (!isValidWebUrl(raw)) {
    throw new Error('Invalid web address');
  }
  const u = new URL(withScheme(raw));
  u.hostname = u.hostname.toLowerCase();
  // Canonicalize scheme to https so http/https variants de-duplicate to the
  // same bookmark (spec US2: scheme is a trivial variation).
  const originalPort = u.port;
  if (u.protocol === 'http:' && (originalPort === '' || originalPort === '80')) {
    u.protocol = 'https:';
  }
  if (u.port && DEFAULT_PORTS[u.protocol] === u.port) {
    u.port = '';
  }
  // Strip a trailing slash when the path is just "/".
  let out = u.toString();
  if (u.pathname === '/' && !u.search && !u.hash) {
    out = out.replace(/\/$/, '');
  }
  return out;
}

// A best-effort human title derived from a URL, used as fallback (FR-007).
export function titleFromUrl(raw) {
  try {
    const u = new URL(withScheme(raw));
    return u.hostname.replace(/^www\./, '') + (u.pathname !== '/' ? u.pathname : '');
  } catch {
    return String(raw || '').trim();
  }
}
