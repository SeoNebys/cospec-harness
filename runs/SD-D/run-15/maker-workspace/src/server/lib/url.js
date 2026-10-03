// T007: URL normalization/validation and title fallback (FR-004, FR-006).

/**
 * Normalize a user-entered address. Adds a missing scheme as https:// and
 * validates that the result is a well-formed http(s) URL.
 * @returns {{ ok: true, url: string } | { ok: false, error: string }}
 */
export function normalizeUrl(input) {
  if (input == null || String(input).trim() === '') {
    return { ok: false, error: 'Please enter a web address.' };
  }
  let raw = String(input).trim();
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(raw)) {
    raw = `https://${raw}`;
  }
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    return { ok: false, error: `"${input}" is not a valid web address.` };
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { ok: false, error: 'Only http and https addresses are supported.' };
  }
  if (!parsed.hostname || !parsed.hostname.includes('.')) {
    return { ok: false, error: `"${input}" is not a valid web address.` };
  }
  return { ok: true, url: parsed.toString() };
}

/** Derive a readable title from a URL when no page title is available (FR-006). */
export function deriveTitleFromUrl(url) {
  try {
    const u = new URL(url);
    const path = u.pathname.replace(/\/+$/, '');
    if (path && path !== '/') {
      const last = path.split('/').filter(Boolean).pop() || '';
      const cleaned = decodeURIComponent(last)
        .replace(/\.[a-z0-9]+$/i, '')
        .replace(/[-_]+/g, ' ')
        .trim();
      if (cleaned) return `${cleaned} — ${u.hostname}`;
    }
    return u.hostname;
  } catch {
    return url;
  }
}
