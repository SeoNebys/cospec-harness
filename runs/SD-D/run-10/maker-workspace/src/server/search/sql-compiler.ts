import type { SearchAst } from './parser.js';

export type CompiledSearch = { sql: string; params: unknown[] };

function ftsValue(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

export function compileSearch(ast: SearchAst | null): CompiledSearch {
  if (!ast) return { sql: '1 = 1', params: [] };
  if (ast.type === 'text') {
    return {
      sql: 'b.id IN (SELECT rowid FROM bookmark_search WHERE bookmark_search MATCH ?)',
      params: [ftsValue(ast.value)],
    };
  }
  if (ast.type === 'tag') {
    return {
      sql: `EXISTS (SELECT 1 FROM bookmark_tags search_bt JOIN tags search_t ON search_t.id = search_bt.tag_id
                    WHERE search_bt.bookmark_id = b.id AND search_t.name_normalized = ?)`,
      params: [ast.value],
    };
  }
  if (ast.type === 'not') {
    const child = compileSearch(ast.child);
    return { sql: `NOT (${child.sql})`, params: child.params };
  }
  const left = compileSearch(ast.left);
  const right = compileSearch(ast.right);
  return {
    sql: `(${left.sql}) ${ast.type === 'and' ? 'AND' : 'OR'} (${right.sql})`,
    params: [...left.params, ...right.params],
  };
}
