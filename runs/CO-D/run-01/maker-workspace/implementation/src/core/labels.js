// Labels: many per link, with reuse discipline that steers away from near-twins.
//
// Scenario basis:
//   SCN-006 — case-insensitive reuse ("Cooking" reuses existing "cooking"); a
//             link can hold multiple labels; remove a label.
//   SCN-013 — a folder path becomes SEPARATE lowercase labels
//             ("Travel/Japan" -> ["travel","japan"], never "travel/japan").
//
// This is one of the "invisible discipline" features (build-priorities.md): the
// reuse nudge is what keeps the label set from rotting into cooking/Cooking/recipes.

/**
 * Resolve the label to store for `raw`, reusing an existing label whose spelling
 * matches case-insensitively. Returns null for empty input.
 */
export function canonicalLabel(existingLabels, raw) {
  const v = (raw ?? '').trim();
  if (!v) return null;
  const hit = (existingLabels || []).find((l) => l.toLowerCase() === v.toLowerCase());
  return hit || v;
}

/** Does this bookmark already carry `label` (case-insensitively)? */
export function hasLabel(bookmark, label) {
  const l = (label ?? '').toLowerCase();
  return (bookmark.labels || []).some((x) => x.toLowerCase() === l);
}

/**
 * Add a label to a bookmark, reusing an existing spelling from `existingLabels`.
 * Mutates bookmark.labels. Returns true if a label was actually added.
 */
export function addLabel(bookmark, existingLabels, raw) {
  const label = canonicalLabel(existingLabels, raw);
  if (!label) return false;
  bookmark.labels = bookmark.labels || [];
  if (hasLabel(bookmark, label)) return false;
  bookmark.labels.push(label);
  return true;
}

/** Remove a label from a bookmark (exact match). Returns true if removed. */
export function removeLabel(bookmark, label) {
  const before = (bookmark.labels || []).length;
  bookmark.labels = (bookmark.labels || []).filter((x) => x !== label);
  return bookmark.labels.length < before;
}

/**
 * Turn a browser folder path into separate labels.
 * "Recipes/Italian" -> ["recipes","italian"]. Blank/edge segments dropped.
 */
export function folderPathToLabels(path) {
  const seen = [];
  (path ?? '')
    .split('/')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
    .forEach((l) => {
      if (!seen.includes(l)) seen.push(l);
    });
  return seen;
}

/** All distinct labels across a set of bookmarks, sorted. */
export function allLabels(bookmarks) {
  const seen = [];
  bookmarks.forEach((b) => (b.labels || []).forEach((l) => { if (!seen.includes(l)) seen.push(l); }));
  return seen.sort((a, b) => a.localeCompare(b));
}
