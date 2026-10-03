import type Database from "better-sqlite3";
import { newId } from "@/lib/id";
import { nowIso } from "@/lib/time";

export const normalizeTag = (tag: string) => tag.trim().normalize("NFKC").toLocaleLowerCase("und");

export function setTags(db: Database.Database, bookmarkId: string, names: string[]) {
  db.prepare("DELETE FROM bookmark_tags WHERE bookmark_id=?").run(bookmarkId);
  for (const display of [...new Set(names.map(v=>v.trim()).filter(Boolean))]) {
    const normalized = normalizeTag(display);
    db.prepare("INSERT INTO tags(id,display_name,normalized_name,created_at) VALUES(?,?,?,?) ON CONFLICT(normalized_name) DO NOTHING")
      .run(newId(), display, normalized, nowIso());
    const tag = db.prepare("SELECT id FROM tags WHERE normalized_name=?").get(normalized) as {id:string};
    db.prepare("INSERT OR IGNORE INTO bookmark_tags(bookmark_id,tag_id) VALUES(?,?)").run(bookmarkId,tag.id);
  }
  db.prepare("DELETE FROM tags WHERE NOT EXISTS (SELECT 1 FROM bookmark_tags WHERE tag_id=tags.id)").run();
}
