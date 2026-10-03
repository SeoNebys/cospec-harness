// Business logic for bookmarks, sitting between the HTTP layer and the store.
// Enforces the rules from the approved scenarios; see SCENARIO-CODE-MAP.md.

import {
  isValidUrl,
  normalizeUrl,
  canonicalHref,
  hostOf,
  normalizeTags,
} from "../public/lib.js";
import { fetchMetadata } from "./metadata.js";

let counter = 0;
function newId() {
  // Monotonic, unique id (ms clock plus a counter to avoid collisions).
  counter = (counter + 1) % 1000;
  return Date.now() * 1000 + counter;
}

export class BookmarkService {
  constructor(store, { fetchMeta = fetchMetadata } = {}) {
    this.store = store;
    this.fetchMeta = fetchMeta;
  }

  list() {
    return this.store.list();
  }

  // SCN-001 (save with auto-filled details), SCN-008 (duplicate prevention),
  // SCN-010 (invalid input rejected; link saved even if details can't be fetched).
  async create(rawUrl) {
    if (!isValidUrl(rawUrl)) {
      return { ok: false, code: "invalid" };
    }
    const urlKey = normalizeUrl(rawUrl);
    const existing = this.store.findByKey(urlKey);
    if (existing) {
      return { ok: false, code: "duplicate", existing, archived: !!existing.archived };
    }
    const href = canonicalHref(rawUrl);
    const meta = await this.fetchMeta(href); // never throws; falls back internally
    const bookmark = {
      id: newId(),
      url: href,
      urlKey,
      host: meta.host || hostOf(href),
      title: meta.title,
      site: meta.site,
      description: meta.description || "",
      tags: [],
      note: "",
      toRead: false,
      archived: false,
      savedAt: Date.now(),
    };
    return { ok: true, bookmark: this.store.insert(bookmark) };
  }

  // SCN-003/004/009 (edit tags, note, title, description in one update),
  // SCN-005 (read-later toggle), SCN-006 (archive/restore clears read-later).
  update(id, patch) {
    const current = this.store.get(id);
    if (!current) return { ok: false, code: "not_found" };

    const next = {};
    if ("title" in patch) {
      const t = String(patch.title || "").trim();
      next.title = t || current.host || current.title; // never nameless (SCN-009)
    }
    if ("description" in patch) next.description = String(patch.description || "").trim();
    if ("note" in patch) next.note = String(patch.note || "").replace(/\s+$/, "");
    if ("tags" in patch) next.tags = normalizeTags(patch.tags);
    if ("toRead" in patch) next.toRead = !!patch.toRead;
    if ("archived" in patch) {
      next.archived = !!patch.archived;
      if (next.archived) next.toRead = false; // archiving clears read-later (SCN-006)
    }
    return { ok: true, bookmark: this.store.update(id, next) };
  }

  // SCN-007 (permanent delete).
  remove(id) {
    return this.store.remove(id) ? { ok: true } : { ok: false, code: "not_found" };
  }
}
