import type { SearchNode } from "./search-parser";
import { normalizeTagName } from "./validation";

export type CompiledSearch = { sql: string; params: string[] };

function ftsLiteral(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

export function compileSearch(node: SearchNode | null, bookmarkAlias = "b"): CompiledSearch {
  if (!node) return { sql: "1 = 1", params: [] };
  if (node.type === "term" || node.type === "phrase") {
    return {
      sql: `EXISTS (SELECT 1 FROM bookmark_search WHERE bookmark_id = ${bookmarkAlias}.id AND bookmark_search MATCH ?)`,
      params: [ftsLiteral(node.value)],
    };
  }
  if (node.type === "tag") {
    return {
      sql: `EXISTS (SELECT 1 FROM bookmark_tags bt_search JOIN tags t_search ON t_search.id = bt_search.tag_id WHERE bt_search.bookmark_id = ${bookmarkAlias}.id AND t_search.normalized_name = ?)`,
      params: [normalizeTagName(node.value).normalizedName],
    };
  }
  if (node.type === "not") {
    const child = compileSearch(node.child, bookmarkAlias);
    return { sql: `NOT (${child.sql})`, params: child.params };
  }
  const left = compileSearch(node.left, bookmarkAlias);
  const right = compileSearch(node.right, bookmarkAlias);
  return { sql: `(${left.sql}) ${node.type.toUpperCase()} (${right.sql})`, params: [...left.params, ...right.params] };
}
