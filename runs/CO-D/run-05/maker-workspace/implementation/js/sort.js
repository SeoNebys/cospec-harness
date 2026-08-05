// List ordering (SCN-014). Newest-first is the everyday default; oldest and
// by-name are the occasional flips. Pure — returns a new array.

export const SORTS = ["new", "old", "az"];

export function sortItems(items, mode = "new") {
  const arr = [...items];
  if (mode === "old") arr.sort((a, b) => (a.savedAt || 0) - (b.savedAt || 0));
  else if (mode === "az")
    arr.sort((a, b) => {
      const x = (a.title || "").toLowerCase();
      const y = (b.title || "").toLowerCase();
      return x < y ? -1 : x > y ? 1 : 0;
    });
  else arr.sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0)); // newest first
  return arr;
}
