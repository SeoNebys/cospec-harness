import type { AppDatabase } from "../../db/database.js";
import { BookmarkNotFoundError } from "../../repositories/bookmark-repository.js";

/** Permanently removes one bookmark and all unshared dependent storage atomically. */
export class BookmarkDeleteService {
  constructor(private readonly database: AppDatabase) {}

  delete(bookmarkId: number): void {
    if (this.deleteMany([bookmarkId]) === 0) throw new BookmarkNotFoundError();
  }

  /** Set-based variant used by bulk deletion under the caller's transaction. */
  deleteMany(bookmarkIds: readonly number[]): number {
    const ids = [...new Set(bookmarkIds)];
    if (ids.length === 0) return 0;
    const slots = ids.map(() => "?").join(", ");
    const remove = this.database.transaction(() => {
      const iconHashes = (
        this.database
          .prepare(
            `SELECT DISTINCT icon_hash FROM bookmarks WHERE id IN (${slots}) AND icon_hash IS NOT NULL`,
          )
          .all(...ids) as Array<{ icon_hash: string }>
      ).map(({ icon_hash }) => icon_hash);

      const result = this.database
        .prepare(`DELETE FROM bookmarks WHERE id IN (${slots})`)
        .run(...ids);

      this.database.exec(`
        DELETE FROM tags
        WHERE NOT EXISTS (
          SELECT 1 FROM bookmark_tags WHERE bookmark_tags.tag_id = tags.id
        )
      `);

      if (iconHashes.length > 0) {
        this.database
          .prepare(`
            DELETE FROM bookmark_icons
            WHERE content_hash IN (${iconHashes.map(() => "?").join(", ")})
              AND NOT EXISTS (
                SELECT 1 FROM bookmarks WHERE bookmarks.icon_hash = bookmark_icons.content_hash
              )
          `)
          .run(...iconHashes);
      }
      return result.changes;
    });
    return remove.immediate();
  }
}
