import "server-only";
import { getSqlite } from "@/lib/db/client";
import { replaceBookmarkTags } from "@/lib/db/repositories/tag-repository";
import { syncBookmarkSearch } from "@/lib/db/repositories/search-repository";
import { normalizeTagName } from "./validation";

export type BulkOperation = "add_tags" | "remove_tags" | "mark_read" | "mark_unread" | "archive" | "restore" | "permanent_delete";
export type BulkResult = { requestedCount: number; succeededIds: string[]; failures: { id: string; code: "not_found" | "invalid_state" | "conflict" | "temporarily_unavailable"; retryable: boolean }[] };

export function applyBulkAction(userId: string, input: { ids: string[]; operation: BulkOperation; tagNames?: string[]; confirmPermanent?: boolean; expectedCount?: number }): BulkResult {
  const ids = [...new Set(input.ids)];
  if (!ids.length || ids.length > 100) throw new Error("Select between 1 and 100 bookmarks.");
  if (input.operation === "permanent_delete" && (input.confirmPermanent !== true || input.expectedCount !== ids.length)) throw new Error("Confirm the exact number of bookmarks to delete permanently.");
  const sqlite = getSqlite();
  const owned = sqlite.prepare(`SELECT id FROM bookmarks WHERE user_id = ? AND id IN (${ids.map(() => "?").join(",")})`).all(userId, ...ids) as { id: string }[];
  const ownedIds = new Set(owned.map((row) => row.id));
  const failures = ids.filter((id) => !ownedIds.has(id)).map((id) => ({ id, code: "not_found" as const, retryable: false }));
  const succeededIds = [...ownedIds];
  sqlite.transaction(() => {
    for (const id of succeededIds) {
      if (input.operation === "mark_read") sqlite.prepare("UPDATE bookmarks SET reading_state='read', updated_at=? WHERE user_id=? AND id=?").run(Date.now(), userId, id);
      else if (input.operation === "mark_unread") sqlite.prepare("UPDATE bookmarks SET reading_state='unread', updated_at=? WHERE user_id=? AND id=?").run(Date.now(), userId, id);
      else if (input.operation === "archive") sqlite.prepare("UPDATE bookmarks SET archived_at=COALESCE(archived_at, ?), updated_at=? WHERE user_id=? AND id=?").run(Date.now(), Date.now(), userId, id);
      else if (input.operation === "restore") sqlite.prepare("UPDATE bookmarks SET archived_at=NULL, updated_at=? WHERE user_id=? AND id=?").run(Date.now(), userId, id);
      else if (input.operation === "permanent_delete") {
        sqlite.prepare("DELETE FROM bookmark_search WHERE bookmark_id=?").run(id);
        sqlite.prepare("DELETE FROM bookmarks WHERE user_id=? AND id=?").run(userId, id);
        continue;
      } else {
        const existing = sqlite.prepare("SELECT t.display_name FROM tags t JOIN bookmark_tags bt ON bt.tag_id=t.id WHERE bt.bookmark_id=? ORDER BY t.display_name").all(id) as { display_name: string }[];
        const map = new Map(existing.map((row) => { const tag = normalizeTagName(row.display_name); return [tag.normalizedName, tag.displayName] as const; }));
        for (const name of input.tagNames ?? []) {
          const tag = normalizeTagName(name);
          if (input.operation === "add_tags") map.set(tag.normalizedName, tag.displayName);
          else map.delete(tag.normalizedName);
        }
        replaceBookmarkTags(sqlite, userId, id, [...map.values()]);
      }
      syncBookmarkSearch(sqlite, id);
    }
    sqlite.prepare("DELETE FROM tags WHERE user_id=? AND NOT EXISTS (SELECT 1 FROM bookmark_tags WHERE tag_id=tags.id)").run(userId);
  })();
  return { requestedCount: ids.length, succeededIds, failures };
}
