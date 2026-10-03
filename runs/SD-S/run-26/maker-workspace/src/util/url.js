// URL validation + normalization for duplicate detection (research.md #6).

// Returns true only for well-formed http(s) web addresses.
export function isValidWebUrl(raw) {
  if (typeof raw !== 'string' || raw.trim() === '') return false;
  let u;
  try {
    u = new URL(raw.trim());
  } catch {
    return false;
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
  if (!u.hostname || !u.hostname.includes('.')) return false;
  return true;
}

// Canonical form for duplicate comparison:
// lowercase scheme+host, strip default ports, drop trailing slash and fragment,
// preserve query string.
export function normalizeUrl(raw) {
  const u = new URL(raw.trim());
  u.protocol = u.protocol.toLowerCase();
  u.hostname = u.hostname.toLowerCase();
  u.hash = '';
  if (
    (u.protocol === 'http:' && u.port === '80') ||
    (u.protocol === 'https:' && u.port === '443')
  ) {
    u.port = '';
  }
  let out = u.toString();
  // Drop a trailing slash on the path (but keep it for the bare origin form).
  if (u.pathname !== '/' && out.endsWith('/')) {
    out = out.slice(0, -1);
  }
  // Normalize "https://host/" -> "https://host"
  if (u.pathname === '/' && !u.search) {
    out = `${u.protocol}//${u.host}`;
  }
  return out;
}

// A readable title derived from the address when no better value exists (FR-005).
export function titleFromUrl(raw) {
  try {
    const u = new URL(raw.trim());
    const last = u.pathname.split('/').filter(Boolean).pop();
    if (last) {
      return decodeURIComponent(last).replace(/[-_]+/g, ' ').replace(/\.[a-z0-9]+$/i, '').trim() || u.hostname;
    }
    return u.hostname;
  } catch {
    return raw;
  }
}
