import type { AppDatabase } from "../db/client.js";

export class BookmarkSearchRepository {
  constructor(private readonly db: AppDatabase) {}

  refresh(bookmarkId: number): void {
    this.db.prepare("DELETE FROM bookmark_search WHERE bookmark_id = ?").run(String(bookmarkId));
    const row = this.db.prepare(`SELECT b.id, b.user_id, b.title, b.url,
      COALESCE(group_concat(t.name, ' '), '') AS tags
      FROM bookmarks b
      LEFT JOIN bookmark_tags bt ON bt.bookmark_id = b.id
      LEFT JOIN tags t ON t.id = bt.tag_id
      WHERE b.id = ? GROUP BY b.id`).get(bookmarkId) as { id: number; user_id: string; title: string; url: string; tags: string } | undefined;
    if (row) this.db.prepare("INSERT INTO bookmark_search (bookmark_id, user_id, title, url, tags) VALUES (?, ?, ?, ?, ?)")
      .run(String(row.id), row.user_id, row.title, row.url, row.tags);
  }

  remove(bookmarkId: number): void {
    this.db.prepare("DELETE FROM bookmark_search WHERE bookmark_id = ?").run(String(bookmarkId));
  }

  rebuild(): void {
    this.db.exec("DELETE FROM bookmark_search");
    const ids = this.db.prepare("SELECT id FROM bookmarks").all() as Array<{ id: number }>;
    for (const { id } of ids) this.refresh(id);
  }
}
