import type Database from 'better-sqlite3';
export class IconRepository {
  constructor(private db: Database.Database) {}
  put(asset: { hash: string; mimeType: string; bytes: Buffer; width: number; height: number }) {
    this.db
      .prepare(
        `INSERT OR IGNORE INTO icon_assets(hash,mime_type,bytes,byte_count,width,height,created_at) VALUES(?,?,?,?,?,?,?)`
      )
      .run(
        asset.hash,
        asset.mimeType,
        asset.bytes,
        asset.bytes.length,
        asset.width,
        asset.height,
        new Date().toISOString()
      );
    return asset.hash;
  }
  get(hash: string) {
    return this.db
      .prepare('SELECT mime_type mimeType,bytes FROM icon_assets WHERE hash=?')
      .get(hash) as { mimeType: string; bytes: Buffer } | undefined;
  }
  cleanup() {
    this.db
      .prepare(
        'DELETE FROM icon_assets WHERE hash NOT IN (SELECT icon_asset_id FROM bookmarks WHERE icon_asset_id IS NOT NULL)'
      )
      .run();
  }
}
