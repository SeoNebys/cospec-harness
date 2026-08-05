// Core URL rules shared by paste-save and import. DOM-free and unit-tested.
// The trust-critical piece: two forms of the same page must produce the same id,
// while two genuinely different pages must not (SCN-002).

// Tracking / marketing params added when a link is clicked from email or social.
// Ignored when deciding "same page". Everything else (incl. page-selecting params
// like a video id) is kept.
export const TRACKING_PARAMS = new Set([
  "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
  "fbclid", "gclid", "gbraid", "wbraid", "mc_cid", "mc_eid", "igshid",
  "ref", "ref_src", "ref_url", "spm", "_hsenc", "_hsmi", "vero_id", "yclid",
]);

export function parseUrl(raw) {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  try {
    return new URL(s.includes("://") ? s : "https://" + s);
  } catch {
    return null;
  }
}

// Loose "is this a web link?" check for the gentle inline error (SCN-009).
export function looksLikeLink(raw) {
  const u = parseUrl(raw);
  return !!(u && /^https?:$/.test(u.protocol) && u.hostname.includes("."));
}

export function hostOf(raw) {
  const u = parseUrl(raw);
  return u ? u.hostname.replace(/^www\./, "") : "";
}

// Stable identity used as the bookmark id and for dedup.
export function normalizeUrl(raw) {
  const u = parseUrl(raw);
  if (!u) return null;
  const host = u.hostname.replace(/^www\./, "").toLowerCase();
  const path = u.pathname.replace(/\/+$/, ""); // drop trailing slash
  const kept = [...u.searchParams.entries()]
    .filter(([k]) => !TRACKING_PARAMS.has(k.toLowerCase()))
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .map(([k, v]) => (v === "" ? k : k + "=" + v))
    .join("&");
  return host + path + (kept ? "?" + kept : "");
}

// A readable title guessed from the address, used as a fallback and as a first
// draft before real metadata arrives.
export function titleFromUrl(raw) {
  const u = parseUrl(raw);
  if (!u) return String(raw || "");
  const seg = u.pathname.split("/").filter(Boolean).pop() || "";
  if (!seg) return u.hostname.replace(/^www\./, "");
  let t = decodeURIComponent(seg)
    .replace(/\.[a-z0-9]{2,5}$/i, "")
    .replace(/[-_+]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
  if (t.length > 80) t = t.slice(0, 77) + "…";
  return t || u.hostname.replace(/^www\./, "");
}
