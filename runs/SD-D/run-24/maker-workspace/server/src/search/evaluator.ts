// Compile a search AST into a SQLite WHERE predicate over the `bookmarks` table.
// Text terms/phrases match case-insensitively as substrings across
// title/description/note/url; #tag matches tag membership.
import { Ast, parseSearch } from './parser';

export interface Predicate {
  sql: string;
  params: unknown[];
}

const TEXT_COLUMNS = ['title', 'description', 'note_markdown', 'url'];

function likeEscape(value: string): string {
  // Escape LIKE metacharacters so user input matches literally.
  return value.replace(/[\\%_]/g, (m) => '\\' + m);
}

function textPredicate(text: string, params: unknown[]): string {
  const needle = '%' + likeEscape(text.toLowerCase()) + '%';
  const clauses = TEXT_COLUMNS.map((col) => {
    params.push(needle);
    return `LOWER(b.${col}) LIKE ? ESCAPE '\\'`;
  });
  return '(' + clauses.join(' OR ') + ')';
}

function build(ast: Ast, params: unknown[]): string {
  switch (ast.kind) {
    case 'empty':
      return '1=1';
    case 'term':
    case 'phrase':
      return textPredicate(ast.kind === 'term' ? ast.text : ast.text, params);
    case 'tag':
      params.push(ast.name);
      return `EXISTS (SELECT 1 FROM bookmark_tags bt JOIN tags t ON t.id = bt.tag_id
                      WHERE bt.bookmark_id = b.id AND t.name = ? COLLATE NOCASE)`;
    case 'not':
      return `NOT (${build(ast.child, params)})`;
    case 'and':
      return `(${build(ast.left, params)} AND ${build(ast.right, params)})`;
    case 'or':
      return `(${build(ast.left, params)} OR ${build(ast.right, params)})`;
  }
}

/** Parse and compile a search expression. Throws SearchSyntaxError on malformed input. */
export function compileSearch(expression: string): Predicate {
  const ast = parseSearch(expression || '');
  const params: unknown[] = [];
  const sql = build(ast, params);
  return { sql, params };
}
