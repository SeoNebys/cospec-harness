// URL validation + normalization (FR-002).

export function normalizeUrl(raw) {
  if (typeof raw !== 'string') return null;
  let s = raw.trim();
  if (!s) return null;
  // Add a scheme if missing so bare "example.com" is accepted.
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(s)) {
    s = 'https://' + s;
  }
  let u;
  try {
    u = new URL(s);
  } catch {
    return null;
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
  if (!u.hostname || !u.hostname.includes('.')) return null;
  // Drop a trailing slash on the path-only root for stable uniqueness.
  return u.toString();
}

export function isValidUrl(raw) {
  return normalizeUrl(raw) !== null;
}
