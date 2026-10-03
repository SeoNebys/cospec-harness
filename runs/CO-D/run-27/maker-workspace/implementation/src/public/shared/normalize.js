// SCN-002: the "same link" rule. Lower-case only scheme + host (case-insensitive
// there), drop a single trailing slash on the path, and keep path + query exactly.
// http/https and www/non-www stay distinct.
export function normalize(url) {
  const raw = String(url || "").trim();
  try {
    const u = new URL(raw);
    const path = u.pathname.replace(/\/+$/, "");
    return u.protocol.toLowerCase() + "//" + u.hostname.toLowerCase() +
      (u.port ? ":" + u.port : "") + path + u.search;
  } catch {
    return raw.replace(/\/+$/, "");
  }
}

// SCN-003/013: a saved address must be a real web link.
export function isValidWebUrl(s) {
  try {
    const u = new URL(String(s).trim());
    return (u.protocol === "http:" || u.protocol === "https:") && !!u.hostname;
  } catch { return false; }
}

// If the address has no scheme, assume https:// (SCN save flow).
export function withScheme(raw) {
  raw = String(raw || "").trim();
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : "https://" + raw;
}

// Prototype/URL-level guess only. The server decides PDF-ness from the actual
// fetched content type (SCN-011); this is a fallback hint.
export function looksLikePdf(u) {
  try { return /\.pdf$/i.test(new URL(u).pathname); } catch { return /\.pdf($|\?)/i.test(String(u)); }
}
