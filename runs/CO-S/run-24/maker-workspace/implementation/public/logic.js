// Shared, pure domain logic — usable in the browser (type="module") and in Node
// tests / server. No DOM, no I/O. This is the single source of truth for the
// behavioural rules approved in SCN-001..009.

export function ensureScheme(raw) {
  const u = String(raw || "").trim();
  if (!u) return "";
  return /^https?:\/\//i.test(u) ? u : "https://" + u;
}

export function hostOf(raw) {
  const u = ensureScheme(raw);
  try {
    return new URL(u).hostname.replace(/^www\./i, "").toLowerCase();
  } catch (e) {
    return String(raw || "")
      .replace(/^https?:\/\//i, "")
      .split("/")[0]
      .replace(/^www\./i, "")
      .toLowerCase();
  }
}

// A "plausible web address" (SCN-008): a domain-like host with a dot and a
// 2+ character final label. Rejects plain text like "dinner ideas".
export function isPlausibleUrl(raw) {
  const u = ensureScheme(raw);
  let host;
  try {
    host = new URL(u).hostname;
  } catch (e) {
    return false;
  }
  if (/\s/.test(host)) return false;
  return /^[^\s.]+(\.[^\s.]+)*\.[a-z]{2,}$/i.test(host);
}

// Normalised address for duplicate comparison (SCN-008): scheme-normalised,
// lower-cased, trailing slashes removed.
export function normalizeUrl(raw) {
  const u = ensureScheme(raw);
  try {
    const p = new URL(u);
    p.hostname = p.hostname.replace(/^www\./i, "").toLowerCase();
    p.protocol = p.protocol.toLowerCase();
    let s = p.toString();
    return s.replace(/\/+$/, "").toLowerCase();
  } catch (e) {
    return u.replace(/\/+$/, "").toLowerCase();
  }
}

export function findDuplicate(links, raw) {
  const target = normalizeUrl(raw);
  return links.find((l) => normalizeUrl(l.url) === target) || null;
}

export function normalizeTag(raw) {
  return String(raw || "").trim().toLowerCase().replace(/^#+/, "").trim();
}

// Returns a NEW tag array with the tag added (deduped). SCN-002.
export function addTag(tags, raw) {
  const t = normalizeTag(raw);
  const list = Array.isArray(tags) ? tags.slice() : [];
  if (t && list.indexOf(t) === -1) list.push(t);
  return list;
}

export function removeTag(tags, raw) {
  const t = normalizeTag(raw);
  return (Array.isArray(tags) ? tags : []).filter((x) => x !== t);
}

// All tag names in use across the collection, sorted (for suggestions). SCN-002.
export function allTags(links) {
  const set = new Set();
  for (const l of links) for (const t of l.tags || []) set.add(t);
  return Array.from(set).sort();
}

// Text a link can be found by (SCN-005): title, description, tags, full web
// address, and the user's note.
export function haystack(link) {
  return [
    link.title || "",
    link.description || "",
    (link.tags || []).join(" "),
    link.url || "",
    link.note || "",
  ]
    .join(" ")
    .toLowerCase();
}

// Search: case-insensitive, all whitespace-separated words must be present. SCN-005.
export function matchesSearch(link, q) {
  const query = String(q || "").trim().toLowerCase();
  if (!query) return true;
  const hay = haystack(link);
  return query.split(/\s+/).filter(Boolean).every((w) => hay.indexOf(w) !== -1);
}

// Tag filter: a link must carry ALL active tags. SCN-005.
export function matchesTags(link, tagFilters) {
  const filters = Array.isArray(tagFilters) ? tagFilters : [];
  const tags = link.tags || [];
  return filters.every((t) => tags.indexOf(t) !== -1);
}

// The visible collection for a given view + search + tag filters, newest first.
// SCN-003 (reading list view), SCN-005 (search/filter), SCN-009 (ordering).
export function visibleLinks(links, { view = "all", q = "", tagFilters = [] } = {}) {
  return links
    .filter((l) => (view === "list" ? !!l.inList : true))
    .filter((l) => matchesSearch(l, q) && matchesTags(l, tagFilters))
    .slice()
    .sort((a, b) => b.savedAt - a.savedAt);
}
