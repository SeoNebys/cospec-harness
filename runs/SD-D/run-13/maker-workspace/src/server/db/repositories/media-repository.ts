import { BaseRepository } from './base-repository.js';

export interface MediaRecord { id: string; mimeType: 'image/png' | 'image/webp'; bytes: Buffer; byteLength: number; width: number; height: number }

export class MediaRepository extends BaseRepository {
  put(asset: MediaRecord): void {
    this.db.prepare(`INSERT OR IGNORE INTO media_assets(id,mime_type,bytes,byte_length,width,height,created_at) VALUES(?,?,?,?,?,?,?)`)
      .run(asset.id, asset.mimeType, asset.bytes, asset.byteLength, asset.width, asset.height, this.now());
  }

  get(id: string): MediaRecord | null {
    const row = this.db.prepare(`SELECT id,mime_type,bytes,byte_length,width,height FROM media_assets WHERE id=?`).get(id) as any;
    return row ? { id: row.id, mimeType: row.mime_type, bytes: row.bytes, byteLength: row.byte_length, width: row.width, height: row.height } : null;
  }

  cleanupUnreferenced(now = this.now()): number {
    return this.db.prepare(`DELETE FROM media_assets WHERE id NOT IN (
      SELECT icon_asset_id FROM bookmarks WHERE icon_asset_id IS NOT NULL UNION
      SELECT preview_asset_id FROM bookmarks WHERE preview_asset_id IS NOT NULL UNION
      SELECT icon_asset_id FROM metadata_drafts WHERE expires_at>? AND icon_asset_id IS NOT NULL UNION
      SELECT preview_asset_id FROM metadata_drafts WHERE expires_at>? AND preview_asset_id IS NOT NULL
    )`).run(now, now).changes;
  }
}
