import type { SearchNode } from '@shared/search.js';
import { normalizeSearch } from '@shared/normalize.js';
export function compileQuery(node: SearchNode | null): { sql: string; params: string[] } {
  if (!node) return { sql: '1=1', params: [] };
  if (node.type === 'text' || node.type === 'phrase') {
    const p = `%${escapeLike(normalizeSearch(node.value))}%`;
    return {
      sql: `(b.search_title LIKE ? ESCAPE '\\' OR b.search_url LIKE ? ESCAPE '\\' OR b.search_description LIKE ? ESCAPE '\\' OR b.search_note LIKE ? ESCAPE '\\' OR EXISTS (SELECT 1 FROM bookmark_tags sx JOIN tags st ON st.id=sx.tag_id WHERE sx.bookmark_id=b.id AND st.normalized_name LIKE ? ESCAPE '\\'))`,
      params: [p, p, p, p, p]
    };
  }
  if (node.type === 'tag')
    return {
      sql: 'EXISTS (SELECT 1 FROM bookmark_tags sx JOIN tags st ON st.id=sx.tag_id WHERE sx.bookmark_id=b.id AND st.normalized_name=?)',
      params: [normalizeSearch(node.value)]
    };
  if (node.type === 'not') {
    const c = compileQuery(node.child);
    return { sql: `NOT (${c.sql})`, params: c.params };
  }
  if (node.type === 'and' || node.type === 'or') {
    const l = compileQuery(node.left),
      r = compileQuery(node.right);
    return {
      sql: `(${l.sql}) ${node.type === 'and' ? 'AND' : 'OR'} (${r.sql})`,
      params: [...l.params, ...r.params]
    };
  }
  return { sql: '1=1', params: [] };
}
const escapeLike = (v: string) => v.replace(/[\\%_]/g, '\\$&');
