// Address validation and input normalization for bookmarks.

/**
 * Validate and normalize a web address.
 * - Accepts absolute http/https URLs.
 * - If no scheme is present, attempts to prefix "https://".
 * Returns { ok: true, address } or { ok: false, error }.
 */
export function normalizeAddress(rawAddress) {
  if (typeof rawAddress !== 'string') {
    return { ok: false, error: 'A valid web address is required.' };
  }

  const trimmed = rawAddress.trim();
  if (!trimmed) {
    return { ok: false, error: 'A valid web address is required.' };
  }

  const candidate = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  let url;
  try {
    url = new URL(candidate);
  } catch {
    return { ok: false, error: 'A valid web address is required.' };
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { ok: false, error: 'A valid web address is required.' };
  }

  if (!url.hostname || !url.hostname.includes('.')) {
    return { ok: false, error: 'A valid web address is required.' };
  }

  return { ok: true, address: url.href };
}

/** Trim a free-text field; empty string becomes null. */
export function normalizeText(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

/**
 * Normalize a list of tag names: trim, drop empties, de-duplicate
 * case-insensitively (preserving first-seen casing).
 */
export function normalizeTags(tags) {
  if (!Array.isArray(tags)) return [];
  const seen = new Set();
  const result = [];
  for (const tag of tags) {
    if (typeof tag !== 'string') continue;
    const trimmed = tag.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(trimmed);
  }
  return result;
}
