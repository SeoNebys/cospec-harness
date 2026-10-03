// URL helpers and file-kind detection.
// Basis: SCN-001 (valid link), SCN-003/SCN-005 (duplicate matching),
//        SCN-012 (reject non-address), SCN-020 (file kind).

// A web address: no whitespace, and a domain with at least one dot
// (protocol and path optional). Basis: SCN-012 assumptions.
export function isValidUrl(url) {
  if (typeof url !== 'string') return false;
  const u = url.trim();
  if (!u || /\s/.test(u)) return false;
  return /^(https?:\/\/)?([a-z0-9-]+\.)+[a-z]{2,}(\/[^\s]*)?$/i.test(u);
}

// Normalised form for duplicate detection: ignore protocol, leading "www.",
// and trailing slashes; case-insensitive. Basis: SCN-003/SCN-005 assumptions.
export function normalizeUrl(url) {
  return String(url)
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .replace(/\/+$/, '')
    .toLowerCase();
}

export function domainOf(url) {
  const u = String(url).replace(/^https?:\/\//i, '').replace(/^www\./i, '');
  return u.split('/')[0].toLowerCase();
}

// Ensure a fetchable absolute URL (add http:// when the scheme is missing).
export function absoluteUrl(url) {
  return /^https?:\/\//i.test(url) ? url : 'http://' + url;
}

// Fallback file-kind guess from the address alone. The authoritative decision
// uses the returned content type (see detectFileKind). Basis: SCN-020.
export function detectFileKindFromUrl(url) {
  const u = String(url).toLowerCase();
  if (/\.pdf(\b|[/?#]|$)/.test(u) || /[?&](type|format|mime)=pdf\b/.test(u) || /\/pdf\//.test(u)) {
    return 'pdf';
  }
  return 'page';
}

// Authoritative file kind: prefer the actual content type returned by the link;
// fall back to the address when no content type is available. Basis: SCN-020.
export function detectFileKind(contentType, url) {
  if (contentType && /application\/pdf/i.test(contentType)) return 'pdf';
  if (contentType && /text\/html|application\/xhtml/i.test(contentType)) return 'page';
  return detectFileKindFromUrl(url);
}
