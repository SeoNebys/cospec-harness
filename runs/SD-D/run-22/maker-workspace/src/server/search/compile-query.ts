import { normalizeTagValue, type SearchAst } from '../../shared/search/ast.js';

export type BookmarkSort = 'createdAt' | 'title';
export type SortOrder = 'asc' | 'desc';
export type BookmarkScope = 'all' | 'unread-read-later';

export type SearchCompileInput = {
  ast: SearchAst;
  selectedTags?: string[];
  scope?: BookmarkScope;
  sort?: BookmarkSort;
  order?: SortOrder;
};

export type CompiledBookmarkQuery = {
  where: string;
  parameters: string[];
  orderBy: string;
};

const SORT_COLUMNS: Record<BookmarkSort, string> = {
  createdAt: 'b.created_at',
  title: 'b.title COLLATE NOCASE',
};

function escapeLike(value: string): string {
  return value.replace(/\\/gu, '\\\\').replace(/%/gu, '\\%').replace(/_/gu, '\\_');
}

export function compileBookmarkQuery(input: SearchCompileInput): CompiledBookmarkQuery {
  const predicates: string[] = [];
  const parameters: string[] = [];

  for (const clause of input.ast.clauses) {
    if (clause.type === 'text') {
      const pattern = `%${escapeLike(clause.value)}%`;
      predicates.push(`(
        search_normalize(b.title) LIKE ? ESCAPE '\\'
        OR search_normalize(b.url) LIKE ? ESCAPE '\\'
        OR search_normalize(coalesce(b.description, '')) LIKE ? ESCAPE '\\'
        OR search_normalize(coalesce(b.notes, '')) LIKE ? ESCAPE '\\'
        OR EXISTS (
          SELECT 1 FROM bookmark_tags search_bt
          JOIN tags search_t ON search_t.id = search_bt.tag_id
          WHERE search_bt.bookmark_id = b.id
            AND search_t.normalized_name LIKE ? ESCAPE '\\'
        )
      )`);
      parameters.push(pattern, pattern, pattern, pattern, pattern);
    } else {
      predicates.push(`EXISTS (
        SELECT 1 FROM bookmark_tags query_bt
        JOIN tags query_t ON query_t.id = query_bt.tag_id
        WHERE query_bt.bookmark_id = b.id
          AND query_t.normalized_name IN (${clause.values.map(() => '?').join(', ')})
      )`);
      parameters.push(...clause.values);
    }
  }

  for (const selectedTag of [...new Set((input.selectedTags ?? []).map(normalizeTagValue).filter(Boolean))]) {
    predicates.push(`EXISTS (
      SELECT 1 FROM bookmark_tags filter_bt
      JOIN tags filter_t ON filter_t.id = filter_bt.tag_id
      WHERE filter_bt.bookmark_id = b.id AND filter_t.normalized_name = ?
    )`);
    parameters.push(selectedTag);
  }

  if ((input.scope ?? 'all') === 'unread-read-later') {
    predicates.push('b.read_later = 1 AND b.is_read = 0');
  } else if (input.scope !== undefined && input.scope !== 'all') {
    throw new TypeError(`Unsupported bookmark scope: ${String(input.scope)}`);
  }

  const sort = input.sort ?? 'createdAt';
  const order = input.order ?? 'desc';
  if (!(sort in SORT_COLUMNS)) throw new TypeError(`Unsupported bookmark sort: ${String(sort)}`);
  if (order !== 'asc' && order !== 'desc') throw new TypeError(`Unsupported sort order: ${String(order)}`);
  const direction = order.toUpperCase();
  const tieBreaker = sort === 'createdAt' ? `b.id ${direction}` : `b.created_at DESC, b.id ASC`;

  return {
    where: predicates.length ? predicates.join('\nAND ') : '1 = 1',
    parameters,
    orderBy: `${SORT_COLUMNS[sort]} ${direction}, ${tieBreaker}`,
  };
}
