import { normalizeSearch, normalizeTag } from '../../shared/normalization/index.js';
import type { SearchNode } from './parser.js';

export type CompiledSearch = { sql: string; params: unknown[] };
function like(value: string) { return `%${normalizeSearch(value).replace(/[\\%_]/g, '\\$&')}%`; }

export function compileSearch(node: SearchNode): CompiledSearch {
  switch (node.type) {
    case 'not': {
      const child = compileSearch(node.child);
      return { sql: `NOT (${child.sql})`, params: child.params };
    }
    case 'and':
    case 'or': {
      const parts = node.children.map(compileSearch);
      return { sql: `(${parts.map((part) => part.sql).join(` ${node.type.toUpperCase()} `)})`, params: parts.flatMap((part) => part.params) };
    }
    case 'tag':
      return { sql: 'EXISTS (SELECT 1 FROM bookmark_tags sbt JOIN tags st ON st.id=sbt.tag_id WHERE sbt.bookmark_id=b.id AND st.normalized_name = ?)', params: [normalizeTag(node.value)] };
    case 'term':
    case 'phrase': {
      const predicate = `(b.title_search LIKE ? ESCAPE '\\' OR b.url_search LIKE ? ESCAPE '\\' OR b.description_search LIKE ? ESCAPE '\\' OR b.notes_search LIKE ? ESCAPE '\\' OR EXISTS (SELECT 1 FROM bookmark_tags sbt JOIN tags st ON st.id=sbt.tag_id WHERE sbt.bookmark_id=b.id AND st.search_name LIKE ? ESCAPE '\\'))`;
      const pattern = like(node.value);
      return { sql: predicate, params: [pattern, pattern, pattern, pattern, pattern] };
    }
  }
}
