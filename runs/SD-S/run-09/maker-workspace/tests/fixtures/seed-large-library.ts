import type { AppDatabase } from "../../src/server/db/client.js";
import { BookmarkSearchRepository } from "../../src/server/repositories/bookmark-search-repository.js";

export function seedLargeLibrary(db: AppDatabase, userId: string, count = 10_000): void {
  const insert = db.prepare(`INSERT INTO bookmarks
    (user_id,url,normalized_url,title,title_sort,title_source,is_favorite,metadata_status,created_at,updated_at)
    VALUES (?,?,?,?,?,'user',?,'ready',?,?)`);
  db.transaction(() => {
    for (let index = 0; index < count; index++) {
      const title = `Reference ${index.toString().padStart(5, "0")}`;
      insert.run(userId, `https://example.com/${index}`, `https://example.com/${index}`, title, title.toLowerCase(), index % 7 === 0 ? 1 : 0, index, index);
    }
    new BookmarkSearchRepository(db).rebuild();
  })();
}
