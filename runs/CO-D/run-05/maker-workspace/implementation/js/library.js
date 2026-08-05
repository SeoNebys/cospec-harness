// Pure collection queries used by the UI and tests. No persistence, no DOM.
import { normalizeUrl } from "./model.js";

export const VIEW = { ALL: "all", TOREAD: "toread", ARCHIVED: "archived" };

// Find an already-saved bookmark that is the same page (SCN-002).
export function findDuplicate(items, url) {
  const id = normalizeUrl(url);
  if (!id) return null;
  return items.find((it) => it.id === id) || null;
}

// Which bookmarks show for a given view. Put-away (archived) links are excluded
// from every normal view — list, label piles, to-read — and only appear in the
// archived view (SCN-012). A multi-label link appears under each of its labels (SCN-005).
export function visibleItems(items, view) {
  if (view === VIEW.ARCHIVED) return items.filter((it) => it.archived);
  const active = items.filter((it) => !it.archived);
  if (view === VIEW.ALL || view == null) return active;
  if (view === VIEW.TOREAD) return active.filter((it) => it.toRead);
  // otherwise `view` is a label name
  return active.filter((it) => it.labels.includes(view));
}

export function toReadCount(items) {
  return items.filter((it) => !it.archived && it.toRead).length;
}

export function labelCount(items, label) {
  return items.filter((it) => !it.archived && it.labels.includes(label)).length;
}

// Labels currently in use on active (non-archived) links, with counts.
export function activeLabelCounts(items) {
  const counts = new Map();
  items.filter((it) => !it.archived).forEach((it) =>
    it.labels.forEach((l) => counts.set(l, (counts.get(l) || 0) + 1))
  );
  return counts;
}
