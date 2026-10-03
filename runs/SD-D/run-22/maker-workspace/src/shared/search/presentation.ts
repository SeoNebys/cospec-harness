import type { SearchAst, SearchClause } from './ast.js';

function quote(value: string): string {
  return `"${value.replace(/\\/gu, '\\\\').replace(/"/gu, '\\"')}"`;
}

function serializeTag(value: string): string {
  return /[\s|()"\\]/u.test(value) ? quote(value) : value;
}

export function serializeSearchClause(clause: SearchClause): string {
  if (clause.type === 'text') return clause.exact ? quote(clause.value) : clause.value;
  if (clause.values.length === 1) return `tag:${serializeTag(clause.values[0]!)}`;
  return `tag:(${clause.values.map(serializeTag).join('|')})`;
}

export function serializeSearchQuery(ast: SearchAst): string {
  return ast.clauses.map(serializeSearchClause).join(' ');
}

export function searchConditionLabels(ast: SearchAst): string[] {
  return ast.clauses.map((clause) => {
    if (clause.type === 'text') {
      return clause.exact ? `Exact phrase: ${quote(clause.value)}` : `Contains: ${clause.value}`;
    }
    if (clause.values.length === 1) return `Tag: ${clause.values[0]}`;
    return `Tag is any of: ${clause.values.join(', ')}`;
  });
}

/** A concise alias used by API presenters. */
export const describeSearch = searchConditionLabels;
