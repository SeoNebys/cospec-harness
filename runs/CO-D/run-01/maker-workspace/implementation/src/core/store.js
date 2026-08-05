// The bookmark store: the single source of truth for the collection, and the one
// place duplicate detection is enforced (so the no-duplicate promise holds for
// both direct saves, SCN-004, and imports, SCN-013).

import { ensureScheme, isUrlLike, dedupeKey } from './url.js';

/** Today's date as 'YYYY-MM-DD'. Injectable for tests. */
export function defaultToday() {
  const n = new Date();
  return (
    n.getFullYear() + '-' + String(n.getMonth() + 1).padStart(2, '0') + '-' + String(n.getDate()).padStart(2, '0')
  );
}

/** Build a bookmark with sane defaults. */
export function makeBookmark(fields) {
  return {
    id: fields.id,
    url: fields.url,
    title: fields.title ?? '',
    summary: fields.summary ?? '',
    note: fields.note ?? '',
    labels: fields.labels ? fields.labels.slice() : [],
    toRead: fields.toRead ?? false,
    savedAt: fields.savedAt,
    copy: fields.copy ?? { kind: 'pending', dead: false },
    imported: fields.imported ?? false,
  };
}

export class Store {
  constructor({ now } = {}) {
    this.bookmarks = [];
    this._id = 0;
    this._now = now || defaultToday;
  }

  today() {
    return this._now();
  }

  get(id) {
    return this.bookmarks.find((b) => b.id === id) || null;
  }

  /** The existing bookmark that is the same page as `url`, or null. */
  findDuplicate(url) {
    const k = dedupeKey(url);
    return this.bookmarks.find((b) => dedupeKey(b.url) === k) || null;
  }

  /**
   * Save a new link.
   *   { status: 'invalid' }                      — not a plausible link
   *   { status: 'duplicate', bookmark }          — already have it (no copy made)
   *   { status: 'added', bookmark }              — newly stored, on top of the list
   */
  save(rawUrl, fields = {}) {
    const url = ensureScheme(rawUrl);
    if (!isUrlLike(url)) return { status: 'invalid' };
    const dup = this.findDuplicate(url);
    if (dup) return { status: 'duplicate', bookmark: dup };
    const b = makeBookmark({ id: ++this._id, url, savedAt: this.today(), ...fields });
    this.bookmarks.unshift(b);
    return { status: 'added', bookmark: b };
  }

  /** Delete a bookmark (and, by definition, its saved copy). */
  remove(id) {
    const i = this.bookmarks.findIndex((b) => b.id === id);
    if (i < 0) return false;
    this.bookmarks.splice(i, 1);
    return true;
  }

  removeMany(ids) {
    const set = new Set(ids);
    const before = this.bookmarks.length;
    this.bookmarks = this.bookmarks.filter((b) => !set.has(b.id));
    return before - this.bookmarks.length;
  }
}
