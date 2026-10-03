// Link normalisation for the "same link" rule (SCN-003).
// Two addresses are the same bookmark when they match ignoring:
//   - http vs https
//   - a leading "www."
//   - a trailing slash
//   - letter casing
// Other differences (query strings, different paths) are kept distinct.

export function normalizeUrl(raw) {
  if (raw == null) return "";
  let s = String(raw).trim().toLowerCase();
  s = s.replace(/^https?:\/\//, "");
  s = s.replace(/^www\./, "");
  s = s.replace(/\/+$/, "");
  return s;
}

// Lightweight plausibility check used to reject non-links (SCN-008).
// Not a guarantee the page exists — just "looks like a web address".
export function isPlausibleLink(raw) {
  const s = String(raw || "").trim();
  if (!s) return false;
  if (/\s/.test(s.replace(/^https?:\/\/\S+$/, ""))) {
    // allow no internal spaces at all
  }
  if (/\s/.test(s)) return false;
  if (/^https?:\/\//i.test(s)) return /^https?:\/\/[^\s.]+\.[^\s]{2,}/i.test(s);
  return /^[^\s]+\.[^\s]{2,}$/.test(s);
}

// Ensure a stored/opened URL has a scheme so links open correctly.
export function ensureScheme(raw) {
  const s = String(raw || "").trim();
  if (!s) return s;
  if (/^https?:\/\//i.test(s)) return s;
  return "https://" + s;
}

export function isPdf(url) {
  return /\.pdf($|\?|#)/i.test(String(url || ""));
}
