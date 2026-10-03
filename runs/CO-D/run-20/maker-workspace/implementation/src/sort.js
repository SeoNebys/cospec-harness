// Sorting (SCN-013). Options: date added (newest/oldest), recently updated,
// title A–Z / Z–A. "updated" reflects the last meaningful change to a bookmark.

export const SORT_MODES = [
  ['added-desc', 'Date added — newest first'],
  ['added-asc', 'Date added — oldest first'],
  ['updated-desc', 'Recently updated'],
  ['title-asc', 'Title — A to Z'],
  ['title-desc', 'Title — Z to A'],
];

export function comparator(mode) {
  switch (mode) {
    case 'added-asc':
      return (a, b) => a.createdAt - b.createdAt;
    case 'updated-desc':
      return (a, b) => (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt);
    case 'title-asc':
      return (a, b) => String(a.title).toLowerCase().localeCompare(String(b.title).toLowerCase());
    case 'title-desc':
      return (a, b) => String(b.title).toLowerCase().localeCompare(String(a.title).toLowerCase());
    case 'added-desc':
    default:
      return (a, b) => b.createdAt - a.createdAt;
  }
}

export function sortItems(items, mode) {
  return items.slice().sort(comparator(mode));
}
