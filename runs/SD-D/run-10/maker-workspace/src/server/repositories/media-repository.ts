import type { AppDatabase } from '../db/database.js';

export type MediaRow = {
  id: number;
  publicId: string;
  userId: number;
  purpose: 'favicon' | 'preview';
  status: 'draft' | 'attached';
  storageKey: string;
  sourceUrl: string | null;
  mimeType: string;
  byteSize: number;
  expiresAt: number | null;
};

export class MediaRepository {
  constructor(private readonly database: AppDatabase) {}

  create(input: Omit<MediaRow, 'id'> & { sha256: string }): MediaRow {
    const result = this.database
      .prepare(
        `INSERT INTO media_assets(public_id, user_id, purpose, status, storage_key, source_url,
          mime_type, byte_size, sha256, created_at, expires_at)
         VALUES (@publicId, @userId, @purpose, @status, @storageKey, @sourceUrl,
          @mimeType, @byteSize, @sha256, @createdAt, @expiresAt)`,
      )
      .run({ ...input, createdAt: Date.now() });
    return this.getById(Number(result.lastInsertRowid))!;
  }

  getOwned(publicId: string, userId: number): MediaRow | null {
    return this.map(
      this.database
        .prepare('SELECT * FROM media_assets WHERE public_id = ? AND user_id = ?')
        .get(publicId, userId),
    );
  }

  getById(id: number): MediaRow | null {
    return this.map(this.database.prepare('SELECT * FROM media_assets WHERE id = ?').get(id));
  }

  attach(id: number, userId: number, storageKey: string): void {
    this.database
      .prepare(
        `UPDATE media_assets SET status = 'attached', expires_at = NULL, storage_key = ?
         WHERE id = ? AND user_id = ?`,
      )
      .run(storageKey, id, userId);
  }

  markDraft(id: number, userId: number, storageKey: string, expiresAt: number): void {
    this.database
      .prepare(
        `UPDATE media_assets SET status = 'draft', expires_at = ?, storage_key = ?
         WHERE id = ? AND user_id = ?`,
      )
      .run(expiresAt, storageKey, id, userId);
  }

  listExpiredDrafts(before: number): MediaRow[] {
    return this.database
      .prepare("SELECT * FROM media_assets WHERE status = 'draft' AND expires_at <= ?")
      .all(before)
      .map((row) => this.map(row)!);
  }

  deleteDraft(id: number, userId: number): void {
    this.database
      .prepare("DELETE FROM media_assets WHERE id = ? AND user_id = ? AND status = 'draft'")
      .run(id, userId);
  }

  listUnreferenced(before: number): MediaRow[] {
    return this.database
      .prepare(
        `SELECT m.* FROM media_assets m
        LEFT JOIN bookmarks bf ON bf.favicon_asset_id=m.id
        LEFT JOIN bookmarks bp ON bp.preview_asset_id=m.id
        WHERE m.status='attached' AND m.created_at<=? AND bf.id IS NULL AND bp.id IS NULL`,
      )
      .all(before)
      .map((row) => this.map(row)!);
  }

  deleteUnreferenced(id: number): void {
    this.database
      .prepare(
        `DELETE FROM media_assets WHERE id=? AND status='attached'
      AND NOT EXISTS(SELECT 1 FROM bookmarks WHERE favicon_asset_id=? OR preview_asset_id=?)`,
      )
      .run(id, id, id);
  }

  private map(value: unknown): MediaRow | null {
    const row = value as Record<string, unknown> | undefined;
    if (!row) return null;
    return {
      id: row.id as number,
      publicId: row.public_id as string,
      userId: row.user_id as number,
      purpose: row.purpose as 'favicon' | 'preview',
      status: row.status as 'draft' | 'attached',
      storageKey: row.storage_key as string,
      sourceUrl: row.source_url as string | null,
      mimeType: row.mime_type as string,
      byteSize: row.byte_size as number,
      expiresAt: row.expires_at as number | null,
    };
  }
}
