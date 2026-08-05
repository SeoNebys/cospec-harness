// Local persistence + state operations (browser). Wraps the pure modules and saves
// to localStorage so the client can just "pull it up" with their data intact.
import { normalizeUrl, hostOf, titleFromUrl } from "./model.js";
import { createLabelIndex } from "./labels.js";
import { buildBookmarksHtml } from "./exporter.js";

const KEY = "bookmarks.v1";

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function createStore() {
  const persisted = load() || { items: [], savePref: { toRead: false } };
  const items = persisted.items || [];
  const savePref = persisted.savePref || { toRead: false };
  let labelIndex = createLabelIndex(items.flatMap((it) => it.labels || []));
  const subs = new Set();

  const save = () => {
    try {
      localStorage.setItem(KEY, JSON.stringify({ items, savePref }));
    } catch {
      /* storage full / unavailable — keep working in-memory this session */
    }
  };
  const emit = () => subs.forEach((fn) => fn());
  const changed = () => { save(); emit(); };
  const byId = (id) => items.find((it) => it.id === id);

  return {
    subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },
    get items() { return items; },
    get savePref() { return savePref; },
    labelIndex,
    canonLabel(name) { return labelIndex.canon(name); },

    findDuplicate(url) {
      const id = normalizeUrl(url);
      return id ? byId(id) || null : null;
    },

    // Create a bookmark shell immediately (never lose the paste); metadata fills in
    // async via applyResolution. Returns { status, item }.
    addFromUrl(url, opts = {}) {
      const id = normalizeUrl(url);
      if (!id) return { status: "invalid" };
      const existing = byId(id);
      if (existing) return { status: "duplicate", item: existing };
      const u = url.includes("://") ? url : "https://" + url;
      const item = {
        id,
        url: u,
        host: hostOf(u),
        title: titleFromUrl(u),
        summary: "",
        note: "",
        labels: [],
        toRead: !!opts.toRead,
        read: false,
        archived: false,
        savedAt: Date.now(),
        needsName: false,
        resolving: true,
      };
      items.unshift(item);
      changed();
      return { status: "saved", item };
    },

    // Fold in what the resolver found — or, on failure, flag it needs a name (SCN-008).
    applyResolution(id, result) {
      const it = byId(id);
      if (!it) return;
      it.resolving = false;
      if (result && result.ok) {
        it.title = result.title || it.title;
        if (result.summary) it.summary = result.summary;
        it.needsName = false;
      } else {
        // couldn't read it — keep the link, stand the address in, ask for a name
        it.title = it.url;
        it.needsName = true;
      }
      changed();
    },

    update(id, fields) {
      const it = byId(id);
      if (!it) return;
      Object.assign(it, fields);
      if ("labels" in fields) {
        labelIndex = createLabelIndex(items.flatMap((x) => x.labels || []));
        this.labelIndex = labelIndex;
      }
      if (it.title && it.title !== it.url) it.needsName = false;
      changed();
    },

    setToRead(id, v) { const it = byId(id); if (it) { it.toRead = v; if (v) it.read = false; changed(); } },
    setRead(id, v) { const it = byId(id); if (it) { it.read = v; if (v) it.toRead = false; changed(); } },
    setArchived(id, v) { const it = byId(id); if (it) { it.archived = v; if (v) it.toRead = false; changed(); } },

    // Delete returns what's needed to undo (SCN-011).
    remove(id) {
      const index = items.findIndex((it) => it.id === id);
      if (index < 0) return null;
      const [item] = items.splice(index, 1);
      changed();
      return { item, index };
    },
    restore(item, index) {
      items.splice(Math.min(index, items.length), 0, item);
      changed();
    },

    setSavePref(toRead) { savePref.toRead = !!toRead; save(); },

    // Bulk import committed drafts (SCN-015).
    importItems(fresh) {
      // newest of the fresh should sit sensibly; keep their own savedAt for sorting
      for (const f of fresh) {
        if (!byId(f.id)) items.push(f);
        (f.labels || []).forEach((l) => labelIndex.canon(l));
      }
      labelIndex = createLabelIndex(items.flatMap((x) => x.labels || []));
      this.labelIndex = labelIndex;
      changed();
    },

    exportHtml() { return buildBookmarksHtml(items); },
  };
}
