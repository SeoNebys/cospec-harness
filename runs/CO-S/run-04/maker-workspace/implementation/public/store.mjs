// Browser-local persistence (SCN-012). The entire collection is stored in
// localStorage so it survives between visits, in the browser it is used in.
// Single user, private — no server-side storage of bookmarks.

const STORAGE_KEY = "bookmarks.v1";

export function loadBookmarks() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data.map(normalize);
  } catch {
    return [];
  }
}

export function saveBookmarks(bookmarks) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bookmarks));
    return true;
  } catch {
    return false;
  }
}

// Ensure each loaded record has the expected shape (forward/backward safety).
function normalize(b) {
  return {
    id: b.id || "bm_" + Math.random().toString(36).slice(2),
    url: b.url || "",
    title: b.title || "",
    description: b.description || "",
    host: b.host || "",
    favicon: b.favicon || "",
    image: b.image || "",
    tags: Array.isArray(b.tags) ? b.tags : [],
    note: b.note || "",
    readLater: !!b.readLater,
    archived: !!b.archived,
    edited: !!b.edited,
    error: !!b.error,
    createdAt: b.createdAt || Date.now(),
  };
}

export { STORAGE_KEY };
