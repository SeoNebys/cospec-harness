import type { Ast } from './parser.ts';

export interface SqlFragment {
  sql: string;
  params: unknown[];
}

/** Escape a term for an FTS5 phrase literal (wrap in double quotes). */
function ftsLiteral(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

/**
 * Compile a search AST into a boolean SQL fragment over alias `b` (bookmark).
 * - text leaf  -> b.rowid IN (SELECT rowid FROM bookmark_fts WHERE bookmark_fts MATCH ?)
 * - tag  leaf  -> EXISTS (tag membership by lowercased name)
 * - and/or/not -> combined with AND / OR / NOT
 * FTS5 tokenization gives case-insensitive text matching (FR-011).
 */
export function compileAst(ast: Ast): SqlFragment {
  switch (ast.type) {
    case 'text': {
      return {
        sql: '(b.rowid IN (SELECT rowid FROM bookmark_fts WHERE bookmark_fts MATCH ?))',
        params: [ftsLiteral(ast.value)],
      };
    }
    case 'tag': {
      return {
        sql:
          '(EXISTS (SELECT 1 FROM bookmark_tag bt JOIN tag t ON t.id = bt.tag_id ' +
          'WHERE bt.bookmark_id = b.id AND t.name = ?))',
        params: [ast.name.trim().toLowerCase()],
      };
    }
    case 'and': {
      const l = compileAst(ast.left);
      const r = compileAst(ast.right);
      return { sql: `(${l.sql} AND ${r.sql})`, params: [...l.params, ...r.params] };
    }
    case 'or': {
      const l = compileAst(ast.left);
      const r = compileAst(ast.right);
      return { sql: `(${l.sql} OR ${r.sql})`, params: [...l.params, ...r.params] };
    }
    case 'not': {
      const e = compileAst(ast.expr);
      return { sql: `(NOT ${e.sql})`, params: e.params };
    }
  }
}
