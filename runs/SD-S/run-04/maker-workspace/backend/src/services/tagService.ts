import type BetterSqlite3 from "better-sqlite3";
import type { Tag } from "../models/types.js";

export interface TagService {
  /** Normalize a raw tag name (trim). Uniqueness is case-insensitive in the DB. */
  normalize(name: string): string;
  /** Find an existing tag by name (case-insensitive) or create it; returns its id. */
  findOrCreate(name: string): number;
  /** Replace the full set of tags on a bookmark with the given names. */
  setTagsForBookmark(bookmarkId: number, names: string[]): void;
  /** Return the tag names for a bookmark, alphabetically. */
  tagsForBookmark(bookmarkId: number): string[];
  /** List all tags with how many bookmarks carry each. */
  listWithCounts(): (Tag & { count: number })[];
}

export function createTagService(db: BetterSqlite3.Database): TagService {
  const insertTag = db.prepare("INSERT OR IGNORE INTO tags (name) VALUES (?)");
  const selectTag = db.prepare("SELECT id FROM tags WHERE name = ? COLLATE NOCASE");
  const clearLinks = db.prepare("DELETE FROM bookmark_tags WHERE bookmark_id = ?");
  const linkTag = db.prepare(
    "INSERT OR IGNORE INTO bookmark_tags (bookmark_id, tag_id) VALUES (?, ?)",
  );
  const selectNames = db.prepare(
    `SELECT t.name FROM tags t
       JOIN bookmark_tags bt ON bt.tag_id = t.id
      WHERE bt.bookmark_id = ?
      ORDER BY t.name COLLATE NOCASE`,
  );
  const selectCounts = db.prepare(
    `SELECT t.id, t.name, COUNT(bt.bookmark_id) AS count
       FROM tags t
       LEFT JOIN bookmark_tags bt ON bt.tag_id = t.id
      GROUP BY t.id
      ORDER BY t.name COLLATE NOCASE`,
  );

  const normalize = (name: string) => name.trim();

  const findOrCreate = (name: string): number => {
    const clean = normalize(name);
    insertTag.run(clean);
    const row = selectTag.get(clean) as { id: number } | undefined;
    if (!row) throw new Error(`Failed to create tag: ${name}`);
    return row.id;
  };

  const setTagsForBookmark = db.transaction((bookmarkId: number, names: string[]) => {
    clearLinks.run(bookmarkId);
    const seen = new Set<string>();
    for (const raw of names) {
      const clean = normalize(raw);
      if (!clean) continue;
      const key = clean.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      linkTag.run(bookmarkId, findOrCreate(clean));
    }
  });

  return {
    normalize,
    findOrCreate,
    setTagsForBookmark: (bookmarkId, names) => setTagsForBookmark(bookmarkId, names),
    tagsForBookmark: (bookmarkId) =>
      (selectNames.all(bookmarkId) as { name: string }[]).map((r) => r.name),
    listWithCounts: () => selectCounts.all() as (Tag & { count: number })[],
  };
}
