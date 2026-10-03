import crypto from "node:crypto";
import type { AppDatabase } from "../db/client.js";
import type { ValidIcon } from "../metadata/validate-icon.js";

export type IconAsset = { id: number; mediaType: string; bytes: Buffer };

export class IconRepository {
  constructor(private readonly db: AppDatabase) {}

  save(icon: ValidIcon): number {
    const sha256 = crypto.createHash("sha256").update(icon.bytes).digest("hex");
    this.db.prepare(`INSERT INTO icon_assets (sha256, media_type, byte_size, bytes, created_at)
      VALUES (?, ?, ?, ?, ?) ON CONFLICT(sha256) DO NOTHING`).run(sha256, icon.mediaType, icon.bytes.length, icon.bytes, Date.now());
    return (this.db.prepare("SELECT id FROM icon_assets WHERE sha256 = ?").get(sha256) as { id: number }).id;
  }

  findForBookmark(userId: string, bookmarkId: number): IconAsset | null {
    return (this.db.prepare(`SELECT i.id, i.media_type AS mediaType, i.bytes
      FROM bookmarks b JOIN icon_assets i ON i.id = b.icon_asset_id
      WHERE b.id = ? AND b.user_id = ?`).get(bookmarkId, userId) as IconAsset | undefined) ?? null;
  }

  cleanupOrphans(): void {
    this.db.prepare(`DELETE FROM icon_assets
      WHERE created_at < ? AND NOT EXISTS (SELECT 1 FROM bookmarks WHERE icon_asset_id = icon_assets.id)`)
      .run(Date.now() - 15 * 60_000);
  }
}
