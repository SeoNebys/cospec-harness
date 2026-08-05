// Import an existing pile of bookmarks at once; export it back out.
//
// Scenario basis:
//   SCN-013 — bring a whole pile in; folders -> split labels; duplicates skipped;
//             ORIGINAL saved dates preserved (missing date -> import date).
//   SCN-014 — export everything to a take-anywhere plain file.
//
// Import is the client's day-one moment of truth (build-priorities.md): it must
// handle a messy, years-old pile gracefully — malformed rows are counted and
// skipped, never allowed to abort the whole import.

import { ensureScheme, isUrlLike, hostOf } from './url.js';
import { folderPathToLabels } from './labels.js';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Parse a simple import text (one bookmark per line):
 *   Title | https://url | Folder/Subfolder | YYYY-MM-DD
 * Any trailing fields may be omitted. Blank lines ignored.
 * (Real app also accepts a browser's exported bookmarks HTML file; this simple
 *  format keeps the domain testable and the file-format parsing at the edge.)
 */
export function parseImport(text) {
  return (text ?? '')
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((line) => {
      const p = line.split('|').map((s) => s.trim());
      return { title: p[0] || '', url: p[1] || '', folder: p[2] || '', date: p[3] || '' };
    });
}

/**
 * Import parsed entries into the store. Returns a summary the UI reports back:
 *   { added, skippedDuplicate, skippedInvalid }
 */
export function importEntries(store, entries) {
  const res = { added: 0, skippedDuplicate: 0, skippedInvalid: 0 };
  for (const e of entries) {
    const url = ensureScheme(e.url);
    if (!isUrlLike(url)) { res.skippedInvalid++; continue; }
    if (store.findDuplicate(url)) { res.skippedDuplicate++; continue; }
    const savedAt = DATE_RE.test(e.date) ? e.date : store.today();
    const r = store.save(url, {
      title: e.title || hostOf(url),
      labels: folderPathToLabels(e.folder),
      savedAt,
      imported: true,
    });
    if (r.status === 'added') res.added++;
    else if (r.status === 'duplicate') res.skippedDuplicate++; // race-safety
  }
  return res;
}

/** Convenience: parse + import in one step. */
export function importText(store, text) {
  return importEntries(store, parseImport(text));
}

/** Export all bookmarks to the same plain, portable line format. */
export function exportText(bookmarks) {
  return bookmarks
    .map((b) => {
      const parts = [b.title || '', b.url, (b.labels || []).join(', '), b.savedAt || ''];
      // Trim trailing empties so a link with no labels/date stays clean.
      while (parts.length > 2 && !parts[parts.length - 1]) parts.pop();
      return parts.join(' | ');
    })
    .join('\n');
}
