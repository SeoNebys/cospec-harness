import { stmt } from '../db/index.js';
import { parseQuery } from '../search/parser.js';

// Execute a parsed search query and return the set of matching bookmark ids.
// Text terms use case-insensitive substring matching across title, description, note,
// and address (FR-014); phrases match the exact substring (FR-016); #tag restricts by
// tag (FR-015). Boolean composition follows the AST (FR-017). Matching spans all
// bookmarks; the caller's list filter applies the archived scope, so the normal list
// excludes archived (FR-019) while the archive view can be searched within.
// Returns null when the query is empty (no text constraint).

function likeEscape(term) {
  return String(term).replace(/[\\%_]/g, (m) => `\\${m}`);
}

function allUniverse() {
  return new Set(stmt('SELECT id FROM bookmarks').all().map((r) => r.id));
}

function matchText(term) {
  const like = `%${likeEscape(term)}%`;
  const rows = stmt(
      `SELECT id FROM bookmarks
       WHERE ( title LIKE @like ESCAPE '\\'
            OR description LIKE @like ESCAPE '\\'
            OR COALESCE(note_md, '') LIKE @like ESCAPE '\\'
            OR url LIKE @like ESCAPE '\\' )`
    )
    .all({ like });
  return new Set(rows.map((r) => r.id));
}

function matchTag(name) {
  const rows = stmt(
      `SELECT b.id FROM bookmarks b
       WHERE EXISTS (SELECT 1 FROM bookmark_tags bt JOIN tags t ON t.id = bt.tag_id
                     WHERE bt.bookmark_id = b.id AND t.name = ? COLLATE NOCASE)`
    )
    .all(name);
  return new Set(rows.map((r) => r.id));
}

function evaluate(node, universe) {
  switch (node.op) {
    case 'term': {
      const { type, value } = node.term;
      if (type === 'tag') return matchTag(value);
      return matchText(value); // word or phrase
    }
    case 'and': {
      const a = evaluate(node.left, universe);
      const b = evaluate(node.right, universe);
      return new Set([...a].filter((id) => b.has(id)));
    }
    case 'or': {
      const a = evaluate(node.left, universe);
      const b = evaluate(node.right, universe);
      return new Set([...a, ...b]);
    }
    case 'not': {
      const c = evaluate(node.child, universe);
      return new Set([...universe].filter((id) => !c.has(id)));
    }
    default:
      return new Set();
  }
}

/**
 * Return an array of matching active bookmark ids for the query string,
 * or null when the query is empty. Throws { code:'invalid_query' } if malformed.
 */
export function searchIds(query) {
  const ast = parseQuery(query);
  if (!ast) return null;
  const universe = allUniverse();
  return [...evaluate(ast, universe)];
}
