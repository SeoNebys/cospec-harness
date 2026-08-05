// URL handling: scheme completion, validity, and the duplicate-detection key.
//
// Scenario basis:
//   SCN-001 — a link without a leading scheme is still accepted
//   SCN-004 — two links are the "same page" ignoring a leading "www." and a
//             trailing "/". Tracking-parameter (?utm_*) normalization is PARKED
//             (goals parking lot) and deliberately NOT done here, so links that
//             differ only by query string are still treated as different pages.

/** Add https:// if the raw input omits a scheme. Returns '' for empty input. */
export function ensureScheme(raw) {
  const v = (raw ?? '').trim();
  if (!v) return '';
  return /^https?:\/\//i.test(v) ? v : 'https://' + v;
}

/** Is this a plausible web link (has a dotted host, no spaces in the host)? */
export function isUrlLike(url) {
  try {
    const u = new URL(url);
    return u.hostname.includes('.') && !/\s/.test(u.hostname);
  } catch {
    return false;
  }
}

/**
 * The key used to decide whether two links are the same page.
 * Approved same-page rules (SCN-004): ignore a leading "www." and a trailing "/".
 * We keep the query string significant on purpose — stripping tracking junk is a
 * parked follow-up, and collapsing all query strings would wrongly merge genuinely
 * different pages (e.g. ?id=1 vs ?id=2).
 */
export function dedupeKey(url) {
  let u;
  try {
    u = new URL(url);
  } catch {
    return (url ?? '').trim().toLowerCase();
  }
  const host = u.hostname.replace(/^www\./i, '').toLowerCase();
  const path = u.pathname.replace(/\/+$/, ''); // drop trailing slash(es)
  return host + path + u.search; // hash intentionally excluded (same page)
}

/** Bare host for display / favicon lookup. */
export function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./i, '');
  } catch {
    return url;
  }
}
