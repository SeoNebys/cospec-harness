import type { SearchCriteria } from '../../shared/contracts/search.js';
import type { AppDatabase } from '../db/database.js';

export type SavedSearchRecord = {
  id: number;
  publicId: string;
  userId: number;
  name: string;
  nameNormalized: string;
  criteria: SearchCriteria;
  version: number;
  createdAt: number;
  updatedAt: number;
};

export class SavedSearchRepository {
  constructor(private readonly database: AppDatabase) {}

  list(userId: number): SavedSearchRecord[] {
    return (
      this.database
        .prepare('SELECT * FROM saved_searches WHERE user_id=? ORDER BY name COLLATE NOCASE')
        .all(userId) as unknown[]
    ).map((row) => this.map(row)!);
  }
  getOwned(userId: number, publicId: string): SavedSearchRecord | null {
    return this.map(
      this.database
        .prepare('SELECT * FROM saved_searches WHERE user_id=? AND public_id=?')
        .get(userId, publicId),
    );
  }
  getByNormalized(userId: number, normalized: string): SavedSearchRecord | null {
    return this.map(
      this.database
        .prepare('SELECT * FROM saved_searches WHERE user_id=? AND name_normalized=?')
        .get(userId, normalized),
    );
  }
  create(input: {
    publicId: string;
    userId: number;
    name: string;
    normalized: string;
    criteria: SearchCriteria;
    includeTagIds: number[];
    excludeTagIds: number[];
    collectionId: number | null;
  }): SavedSearchRecord {
    const now = Date.now();
    this.database.transaction(() => {
      const result = this.database
        .prepare(
          `INSERT INTO saved_searches(public_id,user_id,name,name_normalized,query_text,collection_id,collection_mode,favorite_filter,reading_filter,context,sort,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        )
        .run(
          input.publicId,
          input.userId,
          input.name,
          input.normalized,
          input.criteria.query,
          input.collectionId,
          input.criteria.collection.mode,
          input.criteria.favorite,
          input.criteria.reading,
          input.criteria.context,
          input.criteria.sort,
          now,
          now,
        );
      const id = Number(result.lastInsertRowid);
      const insert = this.database.prepare(
        'INSERT INTO saved_search_tags(saved_search_id,tag_id,polarity) VALUES(?,?,?)',
      );
      for (const tag of input.includeTagIds) insert.run(id, tag, 'include');
      for (const tag of input.excludeTagIds) insert.run(id, tag, 'exclude');
    })();
    return this.getOwned(input.userId, input.publicId)!;
  }
  update(input: {
    userId: number;
    publicId: string;
    expectedVersion: number;
    name: string;
    normalized: string;
    criteria: SearchCriteria;
    includeTagIds: number[];
    excludeTagIds: number[];
    collectionId: number | null;
  }): SavedSearchRecord | null {
    const changed = this.database.transaction(() => {
      const result = this.database
        .prepare(
          `UPDATE saved_searches SET name=?,name_normalized=?,query_text=?,collection_id=?,collection_mode=?,favorite_filter=?,reading_filter=?,context=?,sort=?,updated_at=?,version=version+1 WHERE user_id=? AND public_id=? AND version=?`,
        )
        .run(
          input.name,
          input.normalized,
          input.criteria.query,
          input.collectionId,
          input.criteria.collection.mode,
          input.criteria.favorite,
          input.criteria.reading,
          input.criteria.context,
          input.criteria.sort,
          Date.now(),
          input.userId,
          input.publicId,
          input.expectedVersion,
        );
      if (!result.changes) return false;
      const row = this.database
        .prepare('SELECT id FROM saved_searches WHERE user_id=? AND public_id=?')
        .get(input.userId, input.publicId) as { id: number };
      this.database.prepare('DELETE FROM saved_search_tags WHERE saved_search_id=?').run(row.id);
      const insert = this.database.prepare(
        'INSERT INTO saved_search_tags(saved_search_id,tag_id,polarity) VALUES(?,?,?)',
      );
      for (const tag of input.includeTagIds) insert.run(row.id, tag, 'include');
      for (const tag of input.excludeTagIds) insert.run(row.id, tag, 'exclude');
      return true;
    })();
    return changed ? this.getOwned(input.userId, input.publicId) : null;
  }
  delete(userId: number, publicId: string, expectedVersion: number): boolean {
    return (
      this.database
        .prepare('DELETE FROM saved_searches WHERE user_id=? AND public_id=? AND version=?')
        .run(userId, publicId, expectedVersion).changes > 0
    );
  }
  private map(value: unknown): SavedSearchRecord | null {
    const row = value as Record<string, unknown> | undefined;
    if (!row) return null;
    const tags = this.database
      .prepare(
        `SELECT t.public_id,sst.polarity FROM saved_search_tags sst JOIN tags t ON t.id=sst.tag_id WHERE sst.saved_search_id=?`,
      )
      .all(row.id) as Array<{ public_id: string; polarity: 'include' | 'exclude' }>;
    const collection = row.collection_id
      ? (this.database.prepare('SELECT public_id FROM collections WHERE id=?').get(row.collection_id) as
          | { public_id: string }
          | undefined)
      : undefined;
    const mode = row.collection_mode as 'any' | 'unfiled' | 'id';
    return {
      id: row.id as number,
      publicId: row.public_id as string,
      userId: row.user_id as number,
      name: row.name as string,
      nameNormalized: row.name_normalized as string,
      version: row.version as number,
      createdAt: row.created_at as number,
      updatedAt: row.updated_at as number,
      criteria: {
        query: row.query_text as string,
        includeTagIds: tags.filter((t) => t.polarity === 'include').map((t) => t.public_id),
        excludeTagIds: tags.filter((t) => t.polarity === 'exclude').map((t) => t.public_id),
        collection:
          mode === 'id' && collection
            ? { mode: 'id', id: collection.public_id }
            : mode === 'unfiled'
              ? { mode: 'unfiled' }
              : { mode: 'any' },
        favorite: row.favorite_filter as SearchCriteria['favorite'],
        reading: row.reading_filter as SearchCriteria['reading'],
        context: row.context as SearchCriteria['context'],
        sort: row.sort as SearchCriteria['sort'],
      },
    };
  }
}
