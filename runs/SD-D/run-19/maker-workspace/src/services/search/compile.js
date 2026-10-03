// Compile a search AST into a parameterised SQL WHERE fragment.
// Returns { sql, params }. No user text is interpolated into SQL.
import { parseSearch } from './parser.js';

function escapeLike(value) {
  // Escape LIKE wildcards so terms match literally; ESCAPE '\' used in SQL.
  return String(value).replace(/[\\%_]/g, (c) => `\\${c}`);
}

function compileNode(node, params) {
  switch (node.type) {
    case 'and':
      return `(${compileNode(node.left, params)} AND ${compileNode(node.right, params)})`;
    case 'or':
      return `(${compileNode(node.left, params)} OR ${compileNode(node.right, params)})`;
    case 'not':
      return `(NOT ${compileNode(node.child, params)})`;
    case 'term': {
      const like = `%${escapeLike(node.value)}%`;
      params.push(like, like, like, like);
      return `(b.title LIKE ? ESCAPE '\\' COLLATE NOCASE OR ` +
             `IFNULL(b.description,'') LIKE ? ESCAPE '\\' COLLATE NOCASE OR ` +
             `IFNULL(b.note_md,'') LIKE ? ESCAPE '\\' COLLATE NOCASE OR ` +
             `b.url LIKE ? ESCAPE '\\' COLLATE NOCASE)`;
    }
    case 'tag': {
      params.push(node.value);
      return `EXISTS (SELECT 1 FROM bookmark_tags bt JOIN tag t ON t.id = bt.tag_id ` +
             `WHERE bt.bookmark_id = b.id AND t.name = ? COLLATE NOCASE)`;
    }
    default:
      throw new Error(`Unknown AST node: ${node.type}`);
  }
}

/**
 * Compile a raw query string. Returns { sql: string|null, params: [] }.
 * sql is null for an empty query (matches everything). Throws SearchSyntaxError
 * on invalid queries.
 */
export function compileSearch(query) {
  const ast = parseSearch(query);
  if (!ast) return { sql: null, params: [] };
  const params = [];
  const sql = compileNode(ast, params);
  return { sql, params };
}
