// Sorting the list to cope with volume.
//
// Scenario basis:
//   SCN-015 — Newest first (default), Oldest first, Title A-Z. Applies to
//             whatever is currently shown. "By recently opened" is PARKED.

export const SORT_MODES = ['newest', 'oldest', 'title'];

/** Return a new, sorted array. Ties broken by id so order is stable. */
export function sortBookmarks(list, mode = 'newest') {
  const arr = list.slice();
  arr.sort((a, b) => {
    if (mode === 'title') {
      const t = (a.title || '').localeCompare(b.title || '');
      return t !== 0 ? t : a.id - b.id;
    }
    const c = (a.savedAt || '').localeCompare(b.savedAt || '');
    if (c !== 0) return mode === 'oldest' ? c : -c;
    return mode === 'oldest' ? a.id - b.id : b.id - a.id;
  });
  return arr;
}
