// Shared pure logic — single source of truth used by both the browser UI
// (app.mjs) and the Node tests / server. No DOM, no I/O here.
//
// Behaviour basis: SCN-001, SCN-003, SCN-004, SCN-005, SCN-007, SCN-008.

/** Is `str` a syntactically valid http(s) web address? (SCN-007, SCN-008) */
export function isValidHttpUrl(str) {
  if (typeof str !== "string") return false;
  let u;
  try {
    u = new URL(str.trim());
  } catch {
    return false;
  }
  return u.protocol === "http:" || u.protocol === "https:";
}

/** Human-friendly site name from a URL: hostname without a leading "www.". */
export function siteFromUrl(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** Best-effort title derived from the URL when a page's own title is unknown. */
export function fallbackTitleFromUrl(url) {
  let site = url;
  let path = "";
  try {
    const u = new URL(url);
    site = u.hostname.replace(/^www\./, "");
    path = u.pathname.replace(/\/$/, "").split("/").filter(Boolean).pop() || "";
  } catch {
    /* keep defaults */
  }
  if (!path) return site || url;
  return path
    .replace(/\.\w+$/, "")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Normalise a URL for duplicate comparison (SCN-007). Trims; leaves the rest
 *  intact so genuinely different links stay distinct. */
export function normalizeUrlForCompare(url) {
  return (url || "").trim();
}

/** Does a bookmark match a free-text query across all searchable fields?
 *  Fields: title, site, full URL, tags, description, note. (SCN-003) */
export function matchesQuery(bm, query) {
  const q = (query || "").trim().toLowerCase();
  if (!q) return true;
  const hay = [
    bm.title,
    bm.site,
    bm.url,
    (bm.tags || []).join(" "),
    bm.description,
    bm.note,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return hay.includes(q);
}

/** Filter a bookmark list by the current view. (SCN-003, SCN-004, SCN-005)
 *  tab: "all" | "to-read" | "finished" | "archived"
 *   - all/to-read/finished show only NON-archived bookmarks
 *   - archived shows only archived bookmarks
 *  tag: a single active tag or null
 *  query: free text
 */
export function filterBookmarks(list, { tab = "all", tag = null, query = "" } = {}) {
  return list.filter((bm) => {
    if (tab === "archived") {
      if (!bm.archived) return false;
    } else {
      if (bm.archived) return false;
      if (tab === "to-read" && bm.status !== "to-read") return false;
      if (tab === "finished" && bm.status !== "finished") return false;
    }
    if (tag && !(bm.tags || []).includes(tag)) return false;
    if (!matchesQuery(bm, query)) return false;
    return true;
  });
}

/** Counts for the four tabs, honouring the current tag+query filters.
 *  all/to-read/finished exclude archived; archived counts archived. (SCN-004) */
export function tabCounts(list, { tag = null, query = "" } = {}) {
  const active = list.filter(
    (b) => !b.archived && (!tag || (b.tags || []).includes(tag)) && matchesQuery(b, query)
  );
  return {
    all: active.length,
    "to-read": active.filter((b) => b.status === "to-read").length,
    finished: active.filter((b) => b.status === "finished").length,
    archived: list.filter(
      (b) => b.archived && (!tag || (b.tags || []).includes(tag)) && matchesQuery(b, query)
    ).length,
  };
}

/** All distinct tags in use, sorted — for browsing and suggestions. */
export function allTags(list) {
  return [...new Set(list.flatMap((b) => b.tags || []))].sort((a, b) =>
    a.localeCompare(b)
  );
}
