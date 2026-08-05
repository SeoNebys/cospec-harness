// Case-insensitive label index. First-seen spelling is canonical; later variants
// (typed by hand OR arriving as import folders) reuse it. This is the single
// mechanism that stops "work"/"Work" and "recipe"/"recipes" splits (SCN-004, SCN-015).

export function createLabelIndex(initial = []) {
  const byLower = new Map(); // lowercased -> canonical spelling
  const add = (name) => {
    const raw = (name == null ? "" : String(name)).trim();
    if (!raw) return null;
    const key = raw.toLowerCase();
    if (!byLower.has(key)) byLower.set(key, raw);
    return byLower.get(key);
  };
  initial.forEach(add);
  return {
    // Return the canonical spelling for a name, registering it if new.
    canon: add,
    // Would this name merge into an existing label that is spelled differently?
    isCaseMerge(name) {
      const raw = (name == null ? "" : String(name)).trim();
      if (!raw) return false;
      const existing = byLower.get(raw.toLowerCase());
      return existing != null && existing !== raw;
    },
    has(name) {
      return byLower.has((name == null ? "" : String(name)).trim().toLowerCase());
    },
    // Existing labels whose text contains the query (for reuse suggestions).
    suggestions(query, exclude = []) {
      const q = String(query || "").trim().toLowerCase();
      if (!q) return [];
      const skip = new Set(exclude);
      return [...byLower.values()]
        .filter((l) => !skip.has(l) && l.toLowerCase().includes(q))
        .sort();
    },
    list() {
      return [...byLower.values()].sort((a, b) => (a.toLowerCase() < b.toLowerCase() ? -1 : 1));
    },
  };
}
