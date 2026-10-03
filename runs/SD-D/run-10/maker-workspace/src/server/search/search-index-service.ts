import type { AppDatabase } from '../db/database.js';

export class SearchIndexService {
  constructor(private readonly database: AppDatabase) {}

  refresh(bookmarkId: number): void {
    const row = this.database
      .prepare(
        `SELECT b.id,b.title,b.url,COALESCE(b.description,'') AS description,COALESCE(b.note_plain,'') AS note,
        COALESCE((SELECT group_concat(t.name,' ') FROM bookmark_tags bt JOIN tags t ON t.id=bt.tag_id WHERE bt.bookmark_id=b.id),'') AS tags
       FROM bookmarks b WHERE b.id=?`,
      )
      .get(bookmarkId) as Record<string, unknown> | undefined;
    this.database.prepare('DELETE FROM bookmark_search WHERE rowid=?').run(bookmarkId);
    if (row)
      this.database
        .prepare('INSERT INTO bookmark_search(rowid,title,url,description,note,tags) VALUES(?,?,?,?,?,?)')
        .run(row.id, row.title, row.url, row.description, row.note, row.tags);
  }

  refreshMany(bookmarkIds: number[]): void {
    for (const id of new Set(bookmarkIds)) this.refresh(id);
  }

  rebuild(): number {
    const ids = this.database.prepare('SELECT id FROM bookmarks').all() as Array<{ id: number }>;
    this.database.transaction(() => {
      this.database.prepare('DELETE FROM bookmark_search').run();
      for (const { id } of ids) this.refresh(id);
    })();
    return ids.length;
  }

  rebuildIfIncomplete(): number | undefined {
    const counts = this.database
      .prepare(
        `SELECT
          (SELECT COUNT(*) FROM bookmarks) AS bookmarks,
          (SELECT COUNT(*) FROM bookmark_search) AS indexed`,
      )
      .get() as { bookmarks: number; indexed: number };
    const missing = this.database
      .prepare(
        'SELECT 1 FROM bookmarks b LEFT JOIN bookmark_search s ON s.rowid=b.id WHERE s.rowid IS NULL LIMIT 1',
      )
      .get();
    const orphaned = this.database
      .prepare(
        'SELECT 1 FROM bookmark_search s LEFT JOIN bookmarks b ON b.id=s.rowid WHERE b.id IS NULL LIMIT 1',
      )
      .get();
    if (counts.bookmarks === counts.indexed && !missing && !orphaned) return undefined;
    return this.rebuild();
  }
}
