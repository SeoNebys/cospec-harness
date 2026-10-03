import { AppError } from '../api/errors.js';
import type { AppDatabase } from '../db/database.js';
import type { BookmarkDetail } from '../../shared/contracts/bookmarks.js';
import type { SearchCriteria } from '../../shared/contracts/search.js';
import type { BookmarkRepository } from './bookmark-repository.js';
import { compileSearch } from '../search/sql-compiler.js';
import { parseSearch } from '../search/parser.js';

type Cursor = { value: string | number; publicId: string };

export class SearchRepository {
  constructor(
    private readonly database: AppDatabase,
    private readonly bookmarks: BookmarkRepository,
  ) {}

  search(
    userId: number,
    criteria: SearchCriteria,
    limit = 50,
    cursorText?: string,
  ): { items: BookmarkDetail[]; page: { nextCursor: string | null; hasMore: boolean; total: number } } {
    this.validateFilters(userId, criteria);
    const compiled = compileSearch(parseSearch(criteria.query));
    const where: string[] = [
      'b.user_id = ?',
      criteria.context === 'active' ? 'b.archived_at IS NULL' : 'b.archived_at IS NOT NULL',
      compiled.sql,
    ];
    const params: unknown[] = [userId, ...compiled.params];
    for (const id of criteria.includeTagIds) {
      where.push(
        `EXISTS (SELECT 1 FROM bookmark_tags fbt JOIN tags ft ON ft.id=fbt.tag_id WHERE fbt.bookmark_id=b.id AND ft.public_id=?)`,
      );
      params.push(id);
    }
    for (const id of criteria.excludeTagIds) {
      where.push(
        `NOT EXISTS (SELECT 1 FROM bookmark_tags fbt JOIN tags ft ON ft.id=fbt.tag_id WHERE fbt.bookmark_id=b.id AND ft.public_id=?)`,
      );
      params.push(id);
    }
    if (criteria.collection.mode === 'unfiled') where.push('b.collection_id IS NULL');
    if (criteria.collection.mode === 'id') {
      where.push('c.public_id=?');
      params.push(criteria.collection.id);
    }
    if (criteria.favorite !== 'any') {
      where.push('b.is_favorite=?');
      params.push(criteria.favorite === 'favorite' ? 1 : 0);
    }
    if (criteria.reading !== 'any') {
      where.push('b.reading_state=?');
      params.push(criteria.reading);
    }
    const from = 'FROM bookmarks b LEFT JOIN collections c ON c.id=b.collection_id';
    const total = (
      this.database
        .prepare(`SELECT COUNT(*) AS count ${from} WHERE ${where.join(' AND ')}`)
        .get(...params) as { count: number }
    ).count;
    const cursor = cursorText ? this.decodeCursor(cursorText) : null;
    const sort = this.sort(criteria.sort, cursor, where, params);
    const rows = this.database
      .prepare(
        `SELECT b.public_id,b.created_at,b.updated_at,b.title ${from} WHERE ${where.join(' AND ')} ORDER BY ${sort.order} LIMIT ?`,
      )
      .all(...params, limit + 1) as Array<Record<string, unknown>>;
    const hasMore = rows.length > limit;
    const visible = rows.slice(0, limit);
    const items = this.bookmarks
      .getOwnedMany(
        userId,
        visible.map((row) => row.public_id as string),
      )
      .map((row) => ({ ...row }));
    const last = visible.at(-1);
    return {
      items,
      page: {
        total,
        hasMore,
        nextCursor:
          hasMore && last
            ? this.encodeCursor({ value: sort.value(last), publicId: last.public_id as string })
            : null,
      },
    };
  }

  allMatchingIds(userId: number, criteria: SearchCriteria): Array<{ id: string; version: number }> {
    const result: Array<{ id: string; version: number }> = [];
    let cursor: string | undefined;
    do {
      const page = this.search(userId, criteria, 100, cursor);
      result.push(...page.items.map((item) => ({ id: item.id, version: item.version })));
      cursor = page.page.nextCursor ?? undefined;
    } while (cursor);
    return result;
  }

  private validateFilters(userId: number, criteria: SearchCriteria): void {
    const overlap = criteria.includeTagIds.find((id) => criteria.excludeTagIds.includes(id));
    if (overlap) throw new AppError(422, 'invalid_filters', 'A tag cannot be both included and excluded.');
    for (const id of [...criteria.includeTagIds, ...criteria.excludeTagIds]) {
      if (!this.database.prepare('SELECT 1 FROM tags WHERE user_id=? AND public_id=?').get(userId, id))
        throw new AppError(404, 'tag_not_found', 'Tag was not found.');
    }
    if (
      criteria.collection.mode === 'id' &&
      !this.database
        .prepare('SELECT 1 FROM collections WHERE user_id=? AND public_id=?')
        .get(userId, criteria.collection.id)
    )
      throw new AppError(404, 'collection_not_found', 'Collection was not found.');
  }

  private sort(kind: SearchCriteria['sort'], cursor: Cursor | null, where: string[], params: unknown[]) {
    const configs = {
      newest: {
        column: 'b.created_at',
        direction: 'DESC',
        value: (row: Record<string, unknown>) => row.created_at as number,
      },
      oldest: {
        column: 'b.created_at',
        direction: 'ASC',
        value: (row: Record<string, unknown>) => row.created_at as number,
      },
      title: {
        column: 'lower(b.title)',
        direction: 'ASC',
        value: (row: Record<string, unknown>) => String(row.title).toLocaleLowerCase('en-US'),
      },
      updated: {
        column: 'b.updated_at',
        direction: 'DESC',
        value: (row: Record<string, unknown>) => row.updated_at as number,
      },
    } as const;
    const config = configs[kind];
    if (cursor) {
      const comparison = config.direction === 'ASC' ? '>' : '<';
      where.push(`(${config.column} ${comparison} ? OR (${config.column} = ? AND b.public_id > ?))`);
      params.push(cursor.value, cursor.value, cursor.publicId);
    }
    return { order: `${config.column} ${config.direction}, b.public_id ASC`, value: config.value };
  }
  private encodeCursor(cursor: Cursor) {
    return Buffer.from(JSON.stringify(cursor)).toString('base64url');
  }
  private decodeCursor(value: string): Cursor {
    try {
      const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as Cursor;
      if (!parsed.publicId || !['string', 'number'].includes(typeof parsed.value)) throw new Error();
      return parsed;
    } catch {
      throw new AppError(422, 'invalid_cursor', 'The bookmark page cursor is invalid.');
    }
  }
}
