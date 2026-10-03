import Database from 'better-sqlite3';

export function seedBookmarks(databasePath: string, count = 1000): void {
  const database = new Database(databasePath);
  database.pragma('foreign_keys = ON');
  clearTables(database);

  const insertBookmark = database.prepare(`
    INSERT INTO bookmarks (id, url, normalized_url, title, notes, is_favorite, status, created_at, updated_at, archived_at)
    VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?, NULL)
  `);
  const insertTag = database.prepare('INSERT INTO tags (id, name, normalized_name, created_at) VALUES (?, ?, ?, ?)');
  const attach = database.prepare('INSERT INTO bookmark_tags (bookmark_id, tag_id) VALUES (?, ?)');
  const seed = database.transaction(() => {
    const timestamp = '2026-09-16T12:00:00.000Z';
    const tagIds = ['scale-research', 'scale-tools', 'scale-reading'];
    ['Research', 'Tools', 'Reading'].forEach((name, index) => insertTag.run(tagIds[index], name, name.toLowerCase(), timestamp));
    for (let index = 0; index < count; index += 1) {
      const id = `30000000-0000-4000-8000-${String(index).padStart(12, '0')}`;
      const url = `https://example.com/library/item-${index}`;
      const title = index === count - 1 ? 'Unique performance needle' : `Saved reference ${String(index).padStart(4, '0')}`;
      insertBookmark.run(id, url, url, title, `Notes for collection item ${index}`, index % 5 === 0 ? 1 : 0, timestamp, timestamp);
      attach.run(id, tagIds[index % tagIds.length]);
    }
  });
  seed();
  database.close();
}

export function resetBookmarks(databasePath = '/tmp/bookmark-manager-e2e.db'): void {
  const database = new Database(databasePath);
  database.pragma('foreign_keys = ON');
  clearTables(database);
  database.close();
}

function clearTables(database: Database.Database): void {
  database.transaction(() => database.exec('DELETE FROM bookmark_tags; DELETE FROM bookmarks; DELETE FROM tags;'))();
}
