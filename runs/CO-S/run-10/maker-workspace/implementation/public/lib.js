// Pure, environment-agnostic helpers shared by the server, the browser client,
// and the unit tests. No DOM and no Node APIs may be used here.

export function ensureProtocol(raw) {
  let u = String(raw || "").trim();
  if (!u) return "";
  if (!/^https?:\/\//i.test(u)) u = "https://" + u;
  return u;
}

// A valid link must be parseable and have a host that contains a dot.
// (SCN-010: reject things like "not a link" or "notalink".)
export function isValidUrl(raw) {
  try {
    const u = new URL(ensureProtocol(raw));
    return u.hostname.includes(".");
  } catch {
    return false;
  }
}

export function hostOf(raw) {
  try {
    return new URL(ensureProtocol(raw)).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

// Canonical href we store for a bookmark (keeps path/query, adds protocol).
export function canonicalHref(raw) {
  const u = new URL(ensureProtocol(raw));
  return u.href;
}

// Normalised key used to detect duplicates (SCN-008): lower-cased host without
// "www.", path without a trailing slash, plus any query string.
export function normalizeUrl(raw) {
  try {
    const u = new URL(ensureProtocol(raw));
    const host = u.hostname.replace(/^www\./, "");
    const path = u.pathname.replace(/\/$/, "");
    return (host + path + u.search).toLowerCase();
  } catch {
    return String(raw || "").trim().toLowerCase();
  }
}

export function titleCase(s) {
  return String(s || "")
    .replace(/[-_]/g, " ")
    .replace(/\.\w+$/, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// When page details cannot be fetched, derive a best-guess name from the address
// so the link is never lost or nameless (SCN-001 fallback, SCN-010).
export function deriveFallbackMeta(raw) {
  const host = hostOf(raw);
  let lastPathSegment = "";
  try {
    lastPathSegment = new URL(ensureProtocol(raw)).pathname.split("/").filter(Boolean).pop() || "";
  } catch {
    /* ignore */
  }
  const root = host.split(".")[0] || host;
  const title = lastPathSegment ? titleCase(lastPathSegment) : titleCase(root);
  return { host, title: title || host, site: titleCase(root) || host, description: "" };
}

// Normalise a single tag: trimmed, collapsed whitespace, lower-cased.
export function normalizeTag(t) {
  return String(t || "").trim().replace(/\s+/g, " ").toLowerCase();
}

// De-duplicated, normalised tag list preserving order.
export function normalizeTags(tags) {
  const out = [];
  for (const t of tags || []) {
    const n = normalizeTag(t);
    if (n && !out.includes(n)) out.push(n);
  }
  return out;
}

// Search haystack for one bookmark (SCN-002: title, site, host, url,
// description, tags, note are all searchable).
export function haystack(b) {
  return [b.title, b.site, b.host, b.url, b.description, (b.tags || []).join(" "), b.note]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

// A bookmark matches when every whitespace-separated term in the query is
// present (all-words-must-match, case-insensitive).
export function matchesQuery(b, query) {
  const hay = haystack(b);
  return String(query || "")
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((term) => hay.includes(term));
}

// Which view a bookmark belongs to (SCN-005/006).
export function inView(b, view) {
  if (view === "archived") return !!b.archived;
  if (view === "toread") return !b.archived && !!b.toRead;
  return !b.archived; // "all"
}
