import type { BookmarkDatabase } from '../db/connection.js';
import { BookmarkRepository } from '../db/repositories/bookmark-repository.js';
import type { BookmarkPage, CollectionView, SortDirection, SortField } from '../../shared/api/types.js';
import { AppError, ValidationError } from '../../shared/api/errors.js';
import { LIMITS } from '../../shared/config/limits.js';
import { matchesSearch } from '../../shared/search/evaluator.js';
import { parseSearch, SearchSyntaxError } from '../../shared/search/parser.js';
import { normalizeTag } from '../../shared/tags/normalize-tag.js';

export interface CollectionQuery { view?: string; q?: string; tag?: string; favorite?: string | boolean; toRead?: string | boolean; sort?: string; direction?: string; page?: string | number; pageSize?: string | number }

export class CollectionQueryService {
  constructor(private readonly db: BookmarkDatabase) {}
  list(query: CollectionQuery): BookmarkPage {
    const view = query.view || 'active'; if (!['active','to-read','archive'].includes(view)) throw new ValidationError('Choose a valid collection view.');
    const sortField = (query.sort || 'createdAt') as SortField; if (!['title','createdAt','updatedAt'].includes(sortField)) throw new ValidationError('Choose a valid sort field.');
    const sortDirection = (query.direction || 'desc') as SortDirection; if (!['asc','desc'].includes(sortDirection)) throw new ValidationError('Choose a valid sort direction.');
    const page = Number(query.page || 1), pageSize = Number(query.pageSize || LIMITS.pageSize);
    if (!Number.isInteger(page) || page < 1 || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > LIMITS.maxPageSize) throw new ValidationError('Choose a valid page and page size.');
    let expression;
    try { expression = parseSearch(query.q || ''); } catch (error) {
      if (error instanceof SearchSyntaxError) throw new AppError(422,'SEARCH_SYNTAX_ERROR',error.message,{ query: query.q || '', start: error.start, end: error.end }); throw error;
    }
    const favorite = query.favorite === true || query.favorite === 'true'; const toRead = query.toRead === true || query.toRead === 'true'; const tag = query.tag ? normalizeTag(query.tag) : '';
    let items = new BookmarkRepository(this.db).allForView(view as CollectionView).filter((item) => matchesSearch(expression,{ ...item, tags: item.tags.map((value) => value.name) }));
    if (favorite) items = items.filter((item) => item.favorite); if (toRead) items = items.filter((item) => item.toRead); if (tag) items = items.filter((item) => item.tags.some((value) => normalizeTag(value.name) === tag));
    const direction = sortDirection === 'asc' ? 1 : -1;
    items.sort((a,b) => { const av = sortField === 'title' ? a.title.normalize('NFKC').toLocaleLowerCase('und') : a[sortField]; const bv = sortField === 'title' ? b.title.normalize('NFKC').toLocaleLowerCase('und') : b[sortField]; const comparison = av < bv ? -1 : av > bv ? 1 : a.id.localeCompare(b.id); return comparison * direction; });
    const total = items.length; const start = (page - 1) * pageSize;
    return { items: items.slice(start,start+pageSize).map((candidate) => { const item = { ...candidate }; delete (item as Partial<typeof item>).notesText; return item; }), total, page, pageSize, sortField, sortDirection };
  }
}
