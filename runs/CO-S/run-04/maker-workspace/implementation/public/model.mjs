// Pure helpers for the bookmark model (link handling, identity, dedupe).
// Kept DOM-free so they can be unit-tested under Node.

export function normalizeUrl(raw) {
  let u = String(raw == null ? "" : raw).trim();
  if (!u) return "";
  if (!/^https?:\/\//i.test(u)) u = "https://" + u;
  return u;
}

// Light validity check (SCN-011): parses as an http/https URL with a dotted
// hostname and contains no whitespace.
export function isValidLink(url) {
  const u = String(url == null ? "" : url);
  if (/\s/.test(u)) return false;
  try {
    const parsed = new URL(u);
    return /^https?:$/.test(parsed.protocol) && parsed.hostname.includes(".") && parsed.hostname.length >= 3;
  } catch {
    return false;
  }
}

// Link equality for duplicate detection (SCN-009): ignore a trailing slash,
// case-insensitive on scheme + host, path/query preserved (case-insensitive
// overall to be forgiving).
export function sameLink(a, b) {
  return canonicalLink(a) === canonicalLink(b);
}

export function canonicalLink(url) {
  return String(url == null ? "" : url).trim().toLowerCase().replace(/\/+$/, "");
}

export function hostFromUrl(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return String(url == null ? "" : url);
  }
}

export function makeId() {
  return "bm_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
}

// Find an existing bookmark whose link matches (used to prevent duplicates).
export function findDuplicate(bookmarks, url) {
  return bookmarks.find((b) => sameLink(b.url, url)) || null;
}
