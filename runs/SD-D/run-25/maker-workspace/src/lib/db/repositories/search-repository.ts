import type Database from "better-sqlite3";

export function syncBookmarkSearch(sqlite: Database.Database, bookmarkId: string): void {
  const bookmark = sqlite.prepare(`
    SELECT id, user_id, title, normalized_url, COALESCE(page_description, '') AS page_description,
           COALESCE(note_plain_text, '') AS note_text
    FROM bookmarks WHERE id = ?
  `).get(bookmarkId) as { id: string; user_id: string; title: string; normalized_url: string; page_description: string; note_text: string } | undefined;
  sqlite.prepare("DELETE FROM bookmark_search WHERE bookmark_id = ?").run(bookmarkId);
  if (!bookmark) return;
  const tagRows = sqlite.prepare(`SELECT t.normalized_name FROM tags t JOIN bookmark_tags bt ON bt.tag_id = t.id WHERE bt.bookmark_id = ? ORDER BY t.normalized_name`).all(bookmarkId) as { normalized_name: string }[];
  sqlite.prepare(`INSERT INTO bookmark_search (bookmark_id, user_id, title, url, page_description, note_text, tag_text) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
    bookmark.id,
    bookmark.user_id,
    bookmark.title,
    bookmark.normalized_url,
    bookmark.page_description,
    bookmark.note_text,
    tagRows.map((row) => row.normalized_name).join(" "),
  );
}

export function rebuildBookmarkSearch(sqlite: Database.Database): void {
  sqlite.prepare("DELETE FROM bookmark_search").run();
  const rows = sqlite.prepare("SELECT id FROM bookmarks").all() as { id: string }[];
  for (const row of rows) syncBookmarkSearch(sqlite, row.id);
}
