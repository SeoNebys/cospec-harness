import type { AppDatabase } from "../db/database.js";

export interface StoredIcon {
  contentHash: string;
  pngBytes: Buffer;
  width: number;
  height: number;
  byteLength: number;
  createdAt: string;
}

export class IconRepository {
  constructor(private readonly database: AppDatabase) {}

  put(icon: StoredIcon): void {
    this.database
      .prepare(`
      INSERT INTO bookmark_icons (content_hash, png_bytes, width, height, byte_length, created_at)
      VALUES (@contentHash, @pngBytes, @width, @height, @byteLength, @createdAt)
      ON CONFLICT(content_hash) DO NOTHING
    `)
      .run(icon);
  }

  getForBookmark(bookmarkId: number): Buffer | null {
    const row = this.database
      .prepare(`
      SELECT i.png_bytes AS pngBytes
      FROM bookmarks b
      JOIN bookmark_icons i ON i.content_hash = b.icon_hash
      WHERE b.id = ?
    `)
      .get(bookmarkId) as { pngBytes: Buffer } | undefined;
    return row?.pngBytes ?? null;
  }
}
