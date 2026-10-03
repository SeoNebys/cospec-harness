import { unlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { AppDatabase } from '../db/connection.js';

export async function cleanupExpiredAssets(
  db: AppDatabase,
  now = new Date(),
  directory = resolve('data/assets'),
): Promise<void> {
  const paths = db.transaction(() => {
    db.prepare('DELETE FROM metadata_previews WHERE expires_at <= ?').run(now.toISOString());
    const stale = db
      .prepare(
        `SELECT id,relative_path FROM media_assets m WHERE
      (state='temporary' AND expires_at <= ?) OR
      (state='claimed' AND NOT EXISTS(SELECT 1 FROM bookmarks b WHERE b.icon_asset_id=m.id OR b.preview_asset_id=m.id) AND NOT EXISTS(SELECT 1 FROM metadata_previews p WHERE p.icon_asset_id=m.id OR p.preview_asset_id=m.id))`,
      )
      .all(now.toISOString()) as Array<{ id: number; relative_path: string }>;
    const remove = db.prepare('DELETE FROM media_assets WHERE id=?');
    for (const row of stale) remove.run(row.id);
    return stale.map((row) => row.relative_path);
  })();
  for (const path of paths) await unlink(resolve(directory, path)).catch(() => undefined);
}
