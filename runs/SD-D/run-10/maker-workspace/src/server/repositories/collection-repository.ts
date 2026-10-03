import type { AppDatabase } from '../db/database.js';
import type { CollectionSummary } from '../../shared/contracts/organization.js';

export type CollectionRow = {
  id: number;
  publicId: string;
  userId: number;
  name: string;
  nameNormalized: string;
  version: number;
};

export class CollectionRepository {
  constructor(private readonly database: AppDatabase) {}

  list(userId: number): CollectionSummary[] {
    const rows = this.database
      .prepare(
        `SELECT c.*,
        SUM(CASE WHEN b.id IS NOT NULL AND b.archived_at IS NULL THEN 1 ELSE 0 END) AS active_count,
        SUM(CASE WHEN b.id IS NOT NULL AND b.archived_at IS NOT NULL THEN 1 ELSE 0 END) AS archived_count
       FROM collections c LEFT JOIN bookmarks b ON b.collection_id=c.id
       WHERE c.user_id=? GROUP BY c.id ORDER BY c.name COLLATE NOCASE`,
      )
      .all(userId) as Array<Record<string, unknown>>;
    return rows.map((row) => ({
      id: row.public_id as string,
      name: row.name as string,
      activeBookmarkCount: Number(row.active_count ?? 0),
      archivedBookmarkCount: Number(row.archived_count ?? 0),
      version: row.version as number,
    }));
  }

  getOwned(userId: number, publicId: string): CollectionRow | null {
    return this.map(
      this.database
        .prepare('SELECT * FROM collections WHERE user_id=? AND public_id=?')
        .get(userId, publicId),
    );
  }

  getByNormalized(userId: number, normalized: string): CollectionRow | null {
    return this.map(
      this.database
        .prepare('SELECT * FROM collections WHERE user_id=? AND name_normalized=?')
        .get(userId, normalized),
    );
  }

  create(userId: number, publicId: string, name: string, normalized: string): CollectionRow {
    const now = Date.now();
    this.database
      .prepare(
        'INSERT INTO collections(public_id,user_id,name,name_normalized,created_at,updated_at) VALUES(?,?,?,?,?,?)',
      )
      .run(publicId, userId, name, normalized, now, now);
    return this.getOwned(userId, publicId)!;
  }

  rename(
    userId: number,
    publicId: string,
    expectedVersion: number,
    name: string,
    normalized: string,
  ): CollectionRow | null {
    const result = this.database
      .prepare(
        'UPDATE collections SET name=?,name_normalized=?,updated_at=?,version=version+1 WHERE user_id=? AND public_id=? AND version=?',
      )
      .run(name, normalized, Date.now(), userId, publicId, expectedVersion);
    return result.changes ? this.getOwned(userId, publicId) : null;
  }

  impact(userId: number, publicId: string): number | null {
    const row = this.database
      .prepare(
        'SELECT COUNT(b.id) AS count FROM collections c LEFT JOIN bookmarks b ON b.collection_id=c.id WHERE c.user_id=? AND c.public_id=? GROUP BY c.id',
      )
      .get(userId, publicId) as { count: number } | undefined;
    return row?.count ?? null;
  }

  deleteAndUnfile(userId: number, row: CollectionRow): number {
    return this.database.transaction(() => {
      const result = this.database
        .prepare(
          'UPDATE bookmarks SET collection_id=NULL,updated_at=?,version=version+1 WHERE user_id=? AND collection_id=?',
        )
        .run(Date.now(), userId, row.id);
      this.database.prepare('DELETE FROM collections WHERE id=? AND user_id=?').run(row.id, userId);
      return result.changes;
    })();
  }

  private map(value: unknown): CollectionRow | null {
    const row = value as Record<string, unknown> | undefined;
    return row
      ? {
          id: row.id as number,
          publicId: row.public_id as string,
          userId: row.user_id as number,
          name: row.name as string,
          nameNormalized: row.name_normalized as string,
          version: row.version as number,
        }
      : null;
  }
}
