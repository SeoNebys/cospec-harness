import type { BulkAction, BulkResult } from "../../../shared/contracts/api.js";
import type { AppDatabase } from "../../db/database.js";
import {
  SelectionRepository,
  type SelectionRepositoryOptions,
} from "../../repositories/selection-repository.js";
import { normalizeTagName } from "../../repositories/tag-repository.js";
import { BookmarkDeleteService } from "../bookmarks/bookmark-delete-service.js";

function placeholders(count: number): string {
  return Array.from({ length: count }, () => "?").join(", ");
}

export class BulkActionService {
  private readonly selections: SelectionRepository;
  private readonly deletion: BookmarkDeleteService;

  constructor(
    private readonly database: AppDatabase,
    private readonly now: () => Date = () => new Date(),
    selectionOptions: SelectionRepositoryOptions = {},
  ) {
    this.selections = new SelectionRepository(database, now, selectionOptions);
    this.deletion = new BookmarkDeleteService(database);
  }

  apply(selectionId: string, action: BulkAction): BulkResult {
    return this.selections.consume(selectionId, (selection) => {
      const processedCount = selection.bookmarkIds.length;
      if (processedCount === 0) {
        return { selectedCount: selection.selectedCount, processedCount: 0, changedCount: 0 };
      }

      const changedCount =
        action.type === "add_tags" || action.type === "remove_tags"
          ? this.applyTags(selection.bookmarkIds, action.type, action.tags)
          : this.applyState(selection.bookmarkIds, action.type);
      return { selectedCount: selection.selectedCount, processedCount, changedCount };
    });
  }

  private applyTags(
    bookmarkIds: readonly number[],
    type: "add_tags" | "remove_tags",
    names: readonly string[],
  ): number {
    const normalized = new Map<string, { displayName: string; nameKey: string }>();
    for (const name of names) {
      const tag = normalizeTagName(name);
      if (!normalized.has(tag.nameKey)) normalized.set(tag.nameKey, tag);
    }
    const tags = [...normalized.values()];
    const keys = tags.map(({ nameKey }) => nameKey);
    const now = this.now().toISOString();
    const bookmarkSlots = placeholders(bookmarkIds.length);
    const tagSlots = placeholders(keys.length);

    if (type === "add_tags") {
      const insertTag = this.database.prepare(`
        INSERT INTO tags(display_name, name_key, created_at)
        VALUES (?, ?, ?)
        ON CONFLICT(name_key) DO NOTHING
      `);
      for (const tag of tags) insertTag.run(tag.displayName, tag.nameKey, now);

      const changedIds = (
        this.database
          .prepare(`
            SELECT b.id
            FROM bookmarks b
            WHERE b.id IN (${bookmarkSlots})
              AND EXISTS (
                SELECT 1 FROM tags t
                WHERE t.name_key IN (${tagSlots})
                  AND NOT EXISTS (
                    SELECT 1 FROM bookmark_tags bt
                    WHERE bt.bookmark_id = b.id AND bt.tag_id = t.id
                  )
              )
            ORDER BY b.id
          `)
          .all(...bookmarkIds, ...keys) as Array<{ id: number }>
      ).map(({ id }) => id);

      const attach = this.database.prepare(`
        INSERT OR IGNORE INTO bookmark_tags(bookmark_id, tag_id)
        SELECT b.id, t.id
        FROM bookmarks b, tags t
        WHERE b.id IN (${bookmarkSlots}) AND t.name_key = ?
      `);
      for (const key of keys) attach.run(...bookmarkIds, key);
      this.touch(changedIds, now);
      return changedIds.length;
    }

    const changedIds = (
      this.database
        .prepare(`
          SELECT DISTINCT bt.bookmark_id AS id
          FROM bookmark_tags bt
          JOIN tags t ON t.id = bt.tag_id
          WHERE bt.bookmark_id IN (${bookmarkSlots})
            AND t.name_key IN (${tagSlots})
          ORDER BY bt.bookmark_id
        `)
        .all(...bookmarkIds, ...keys) as Array<{ id: number }>
    ).map(({ id }) => id);
    this.database
      .prepare(`
        DELETE FROM bookmark_tags
        WHERE bookmark_id IN (${bookmarkSlots})
          AND tag_id IN (SELECT id FROM tags WHERE name_key IN (${tagSlots}))
      `)
      .run(...bookmarkIds, ...keys);
    this.cleanupOrphanTags();
    this.touch(changedIds, now);
    return changedIds.length;
  }

  private applyState(
    bookmarkIds: readonly number[],
    type: Exclude<BulkAction["type"], "add_tags" | "remove_tags">,
  ): number {
    const slots = placeholders(bookmarkIds.length);
    const now = this.now().toISOString();
    if (type === "delete") {
      return this.deletion.deleteMany(bookmarkIds);
    }

    const assignments = {
      favorite: { set: "is_favorite = 1", condition: "is_favorite = 0" },
      unfavorite: { set: "is_favorite = 0", condition: "is_favorite = 1" },
      mark_unread: { set: "is_unread = 1", condition: "is_unread = 0" },
      mark_read: { set: "is_unread = 0", condition: "is_unread = 1" },
      archive: { set: "archived_at = ?", condition: "archived_at IS NULL", value: now },
      restore: { set: "archived_at = NULL", condition: "archived_at IS NOT NULL" },
    } as const;
    const assignment = assignments[type];
    const parameters =
      "value" in assignment ? [assignment.value, now, ...bookmarkIds] : [now, ...bookmarkIds];
    const result = this.database
      .prepare(`
        UPDATE bookmarks
        SET ${assignment.set}, updated_at = ?
        WHERE id IN (${slots}) AND ${assignment.condition}
      `)
      .run(...parameters);
    return result.changes;
  }

  private touch(bookmarkIds: readonly number[], now: string): void {
    if (bookmarkIds.length === 0) return;
    this.database
      .prepare(
        `UPDATE bookmarks SET updated_at = ? WHERE id IN (${placeholders(bookmarkIds.length)})`,
      )
      .run(now, ...bookmarkIds);
  }

  private cleanupOrphanTags(): void {
    this.database.exec(`
      DELETE FROM tags
      WHERE NOT EXISTS (
        SELECT 1 FROM bookmark_tags WHERE bookmark_tags.tag_id = tags.id
      )
    `);
  }
}
