// URL handling: normalisation, validation, duplicate keys, PDF detection.
// Behaviour basis: SCN-001 (save), SCN-002 (duplicate rule), SCN-011 (invalid),
// SCN-016 (PDF detection).

export function normalizeUrl(raw) {
  const s = String(raw || '').trim();
  return /^https?:\/\//i.test(s) ? s : 'https://' + s;
}

export function hostOf(raw) {
  try {
    return new URL(normalizeUrl(raw)).hostname.replace(/^www\./i, '');
  } catch {
    return String(raw || '');
  }
}

// A plausible web address: parseable, host contains a dot, no whitespace in host.
export function isValidUrl(raw) {
  try {
    const u = new URL(normalizeUrl(raw));
    return u.hostname.indexOf('.') > 0 && !/\s/.test(u.hostname);
  } catch {
    return false;
  }
}

// Duplicate key (SCN-002): host is case-insensitive with a leading "www." and a
// trailing slash ignored; the path (and query) keep their original capitalisation.
export function dedupKey(raw) {
  try {
    const u = new URL(normalizeUrl(raw));
    const host = u.hostname.replace(/^www\./i, '').toLowerCase();
    const path = (u.pathname + (u.search || '')).replace(/\/$/, '');
    return host + path;
  } catch {
    return String(raw || '');
  }
}

// PDF links keep the PDF itself offline (SCN-016). Robust to ?query / #hash.
export function isPdf(raw) {
  return /\.pdf($|[?#])/i.test(String(raw || ''));
}
