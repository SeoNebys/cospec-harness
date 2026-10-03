import type { AppDatabase } from "../db/client.js";
import type { Folder, Tag } from "../../shared/contracts/organization.js";
import { BookmarkSearchRepository } from "./bookmark-search-repository.js";

export class OrganizationRepository {
  private readonly search: BookmarkSearchRepository;
  constructor(private readonly db: AppDatabase) { this.search = new BookmarkSearchRepository(db); }

  listFolders(userId: string): Folder[] {
    return this.db.prepare(`SELECT f.id,f.name,count(b.id) AS count FROM folders f LEFT JOIN bookmarks b ON b.folder_id=f.id AND b.user_id=f.user_id
      WHERE f.user_id=? GROUP BY f.id ORDER BY f.name_key`).all(userId) as Folder[];
  }
  listTags(userId: string): Tag[] {
    return this.db.prepare(`SELECT t.id,t.name,count(bt.bookmark_id) AS count FROM tags t LEFT JOIN bookmark_tags bt ON bt.tag_id=t.id AND bt.user_id=t.user_id
      WHERE t.user_id=? GROUP BY t.id ORDER BY t.name_key`).all(userId) as Tag[];
  }
  create(kind: "folders" | "tags", userId: string, name: string, key: string): Folder | Tag {
    const now = Date.now();
    const result = this.db.prepare(`INSERT INTO ${kind} (user_id,name,name_key,created_at,updated_at) VALUES (?,?,?,?,?)`).run(userId, name, key, now, now);
    return { id: Number(result.lastInsertRowid), name, count: 0 };
  }
  rename(kind: "folders" | "tags", userId: string, id: number, name: string, key: string): boolean {
    const affected = kind === "tags" ? (this.db.prepare("SELECT bookmark_id AS id FROM bookmark_tags WHERE tag_id=? AND user_id=?").all(id, userId) as Array<{ id: number }>) : [];
    const changed = this.db.prepare(`UPDATE ${kind} SET name=?,name_key=?,updated_at=? WHERE id=? AND user_id=?`).run(name, key, Date.now(), id, userId).changes > 0;
    for (const row of affected) this.search.refresh(row.id);
    return changed;
  }
  delete(kind: "folders" | "tags", userId: string, id: number): boolean {
    return this.db.transaction(() => {
      if (kind === "folders") this.db.prepare("UPDATE bookmarks SET folder_id=NULL,updated_at=? WHERE folder_id=? AND user_id=?").run(Date.now(), id, userId);
      const affected = kind === "tags" ? (this.db.prepare("SELECT bookmark_id AS id FROM bookmark_tags WHERE tag_id=? AND user_id=?").all(id, userId) as Array<{ id: number }>) : [];
      const changed = this.db.prepare(`DELETE FROM ${kind} WHERE id=? AND user_id=?`).run(id, userId).changes > 0;
      for (const row of affected) this.search.refresh(row.id);
      return changed;
    })();
  }
}
