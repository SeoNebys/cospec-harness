import { db } from "./db.ts";

export interface Bookmark {
  id: number;
  url: string;
  title: string;
  notes: string;
  created_at: string;
  tags: string[];
}

interface BookmarkRow {
  id: number;
  url: string;
  title: string;
  notes: string;
  created_at: string;
  tags: string | null;
}

interface BookmarkInput {
  url: string;
  title?: string;
  notes?: string;
  tags?: string[];
}

// Normalize a raw tag list: trim, lowercase, drop empties, de-duplicate.
function normalizeTags(tags: string[] | undefined): string[] {
  if (!tags) return [];
  const seen = new Set<string>();
  for (const raw of tags) {
    const t = raw.trim().toLowerCase();
    if (t) seen.add(t);
  }
  return [...seen];
}

const upsertTag = db.prepare(
  "INSERT INTO tags (name) VALUES (?) ON CONFLICT(name) DO NOTHING"
);
const getTagId = db.prepare<[string], { id: number }>(
  "SELECT id FROM tags WHERE name = ?"
);
const linkTag = db.prepare(
  "INSERT OR IGNORE INTO bookmark_tags (bookmark_id, tag_id) VALUES (?, ?)"
);
const clearTags = db.prepare(
  "DELETE FROM bookmark_tags WHERE bookmark_id = ?"
);

// Replace the full set of tags attached to a bookmark.
const setTags = db.transaction((bookmarkId: number, tags: string[]) => {
  clearTags.run(bookmarkId);
  for (const name of tags) {
    upsertTag.run(name);
    const row = getTagId.get(name)!;
    linkTag.run(bookmarkId, row.id);
  }
});

// Remove tags no longer referenced by any bookmark, keeping the tag list tidy.
const pruneOrphanTags = db.prepare(
  "DELETE FROM tags WHERE id NOT IN (SELECT DISTINCT tag_id FROM bookmark_tags)"
);

function rowToBookmark(row: BookmarkRow): Bookmark {
  return {
    id: row.id,
    url: row.url,
    title: row.title,
    notes: row.notes,
    created_at: row.created_at,
    tags: row.tags ? row.tags.split(",").sort() : [],
  };
}

export function listBookmarks(opts: { search?: string; tag?: string }): Bookmark[] {
  const where: string[] = [];
  const params: Record<string, string> = {};

  if (opts.search) {
    where.push("(b.title LIKE @q OR b.url LIKE @q OR b.notes LIKE @q)");
    params.q = `%${opts.search}%`;
  }
  if (opts.tag) {
    where.push(
      "b.id IN (SELECT bt.bookmark_id FROM bookmark_tags bt " +
        "JOIN tags t ON t.id = bt.tag_id WHERE t.name = @tag)"
    );
    params.tag = opts.tag.trim().toLowerCase();
  }

  const sql = `
    SELECT b.*, GROUP_CONCAT(t.name) AS tags
    FROM bookmarks b
    LEFT JOIN bookmark_tags bt ON bt.bookmark_id = b.id
    LEFT JOIN tags t ON t.id = bt.tag_id
    ${where.length ? "WHERE " + where.join(" AND ") : ""}
    GROUP BY b.id
    ORDER BY b.created_at DESC, b.id DESC
  `;
  const rows = db
    .prepare<Record<string, string>, BookmarkRow>(sql)
    .all(params) as BookmarkRow[];
  return rows.map(rowToBookmark);
}

export function getBookmark(id: number): Bookmark | undefined {
  const row = db
    .prepare<[number], BookmarkRow>(
      `SELECT b.*, GROUP_CONCAT(t.name) AS tags
       FROM bookmarks b
       LEFT JOIN bookmark_tags bt ON bt.bookmark_id = b.id
       LEFT JOIN tags t ON t.id = bt.tag_id
       WHERE b.id = ?
       GROUP BY b.id`
    )
    .get(id);
  return row ? rowToBookmark(row) : undefined;
}

export function createBookmark(input: BookmarkInput): Bookmark {
  const tags = normalizeTags(input.tags);
  const create = db.transaction(() => {
    const info = db
      .prepare(
        "INSERT INTO bookmarks (url, title, notes) VALUES (@url, @title, @notes)"
      )
      .run({
        url: input.url.trim(),
        title: (input.title ?? "").trim(),
        notes: (input.notes ?? "").trim(),
      });
    const id = Number(info.lastInsertRowid);
    setTags(id, tags);
    return id;
  });
  return getBookmark(create())!;
}

export function updateBookmark(
  id: number,
  input: BookmarkInput
): Bookmark | undefined {
  const existing = getBookmark(id);
  if (!existing) return undefined;
  const tags = normalizeTags(input.tags);
  const update = db.transaction(() => {
    db.prepare(
      "UPDATE bookmarks SET url = @url, title = @title, notes = @notes WHERE id = @id"
    ).run({
      id,
      url: input.url.trim(),
      title: (input.title ?? "").trim(),
      notes: (input.notes ?? "").trim(),
    });
    setTags(id, tags);
    pruneOrphanTags.run();
  });
  update();
  return getBookmark(id);
}

export function deleteBookmark(id: number): boolean {
  const del = db.transaction(() => {
    const info = db.prepare("DELETE FROM bookmarks WHERE id = ?").run(id);
    pruneOrphanTags.run();
    return info.changes > 0;
  });
  return del();
}

export function listTags(): { name: string; count: number }[] {
  return db
    .prepare<[], { name: string; count: number }>(
      `SELECT t.name AS name, COUNT(bt.bookmark_id) AS count
       FROM tags t
       JOIN bookmark_tags bt ON bt.tag_id = t.id
       GROUP BY t.id
       ORDER BY count DESC, t.name ASC`
    )
    .all();
}
