// Translate a search AST into a parameterized SQLite WHERE fragment.
//
// Text terms match case-insensitively (SQLite LIKE is ASCII-case-insensitive)
// across address (url), title, description, notes, and tags (FR-011/FR-012).
// Tag tokens constrain to bookmarks carrying that tag (FR-013). The fragment
// references the bookmark table under alias `b`.

function likeEscape(value) {
  // Escape LIKE wildcards; used with ESCAPE '\'.
  return String(value).replace(/[\\%_]/g, (m) => '\\' + m);
}

function termClause(value, params) {
  const like = `%${likeEscape(value)}%`;
  // address, title, description, notes, or any tag name
  params.push(like, like, like, like, like);
  return `(
    b.url LIKE ? ESCAPE '\\'
    OR b.title LIKE ? ESCAPE '\\'
    OR COALESCE(b.description,'') LIKE ? ESCAPE '\\'
    OR COALESCE(b.notes_markdown,'') LIKE ? ESCAPE '\\'
    OR EXISTS (
      SELECT 1 FROM bookmark_tags bt JOIN tag t ON t.id = bt.tag_id
      WHERE bt.bookmark_id = b.id AND t.name LIKE ? ESCAPE '\\'
    )
  )`;
}

function tagClause(value, params) {
  params.push(value);
  return `EXISTS (
    SELECT 1 FROM bookmark_tags bt JOIN tag t ON t.id = bt.tag_id
    WHERE bt.bookmark_id = b.id AND t.name = ? COLLATE NOCASE
  )`;
}

function build(node, params) {
  switch (node.type) {
    case 'and':
      return `(${build(node.left, params)} AND ${build(node.right, params)})`;
    case 'or':
      return `(${build(node.left, params)} OR ${build(node.right, params)})`;
    case 'not':
      return `(NOT ${build(node.child, params)})`;
    case 'term':
      return termClause(node.value, params);
    case 'tag':
      return tagClause(node.value, params);
    default:
      throw new Error(`Unknown AST node: ${node.type}`);
  }
}

// Returns { sql, params }. For an empty/null AST, sql is '1' (matches all).
export function toSql(ast) {
  if (!ast) return { sql: '1', params: [] };
  const params = [];
  const sql = build(ast, params);
  return { sql, params };
}
