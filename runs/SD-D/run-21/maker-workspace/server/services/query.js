import db from '../db/connection.js';
import { listRaw, serialize } from '../models/bookmark.js';
import { compileQuery } from './search/evaluate.js';

// Attaches tags + note_text to a raw row for search evaluation.
function withSearchFields(raw) {
  const tags = db
    .prepare(
      `SELECT t.name FROM tag t JOIN bookmark_tag bt ON bt.tag_id = t.id WHERE bt.bookmark_id = ?`
    )
    .all(raw.id)
    .map((r) => r.name);
  return { ...raw, tags };
}

// Runs a view + tag filter + boolean query and returns serialized bookmarks.
// Throws SearchSyntaxError on a malformed query (caller maps to 400).
export function runQuery({ view, q, includeTags, excludeTags, sort }) {
  const rows = listRaw({ view, includeTags, excludeTags, sort });
  const predicate = q && q.trim() ? compileQuery(q) : () => true;
  const matched = rows.filter((r) => predicate(withSearchFields(r)));
  return matched.map((r) => serialize(r));
}

// Same filtering but returns only ids (for bulk "select all in results").
export function runQueryIds(opts) {
  return runQuery(opts).map((b) => b.id);
}
