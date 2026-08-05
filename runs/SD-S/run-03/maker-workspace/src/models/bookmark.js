/**
 * Bookmark data access and validation.
 *
 * Covers all user stories: create / getById / list (with search + tag filter +
 * ordering) / update / delete, plus note and tag handling and duplicate
 * detection.
 */

/** True if `value` is a well-formed http/https URL. */
export function isValidHttpUrl(value) {
  if (typeof value !== "string" || value.trim() === "") return false;
  let parsed;
  try {
    parsed = new URL(value.trim());
  } catch {
    return false;
  }
  return parsed.protocol === "http:" || parsed.protocol === "https:";
}

/**
 * Conservative normalized form used only for duplicate detection.
 * Lowercases scheme + host and trims a trailing slash from the path;
 * query and fragment are preserved so genuinely different pages stay distinct.
 */
export function normalizeUrlKey(value) {
  const parsed = new URL(value.trim());
  const scheme = parsed.protocol.toLowerCase();
  const host = parsed.host.toLowerCase();
  let path = parsed.pathname;
  if (path === "/") path = "";
  else if (path.endsWith("/")) path = path.slice(0, -1);
  return `${scheme}//${host}${path}${parsed.search}`;
}

/** Normalize a tag list: trim, drop empties, dedupe case-insensitively. */
export function normalizeTags(tags) {
  if (!Array.isArray(tags)) return [];
  const seen = new Set();
  const out = [];
  for (const raw of tags) {
    if (typeof raw !== "string") continue;
    const name = raw.trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  return out;
}

export function createBookmarkModel(db) {
  const insertStmt = db.prepare(
    `INSERT INTO bookmarks (url, title, note, url_key, created_at)
     VALUES (@url, @title, @note, @url_key, @created_at)`
  );
  const getByIdStmt = db.prepare(`SELECT * FROM bookmarks WHERE id = ?`);
  const findByKeyStmt = db.prepare(`SELECT * FROM bookmarks WHERE url_key = ? LIMIT 1`);
  const updateStmt = db.prepare(
    `UPDATE bookmarks SET url = @url, title = @title, note = @note, url_key = @url_key WHERE id = @id`
  );
  const deleteStmt = db.prepare(`DELETE FROM bookmarks WHERE id = ?`);

  const findTagStmt = db.prepare(`SELECT id FROM tags WHERE name = ? COLLATE NOCASE`);
  const insertTagStmt = db.prepare(`INSERT INTO tags (name) VALUES (?)`);
  const clearTagsStmt = db.prepare(`DELETE FROM bookmark_tags WHERE bookmark_id = ?`);
  const linkTagStmt = db.prepare(
    `INSERT OR IGNORE INTO bookmark_tags (bookmark_id, tag_id) VALUES (?, ?)`
  );
  const tagsForStmt = db.prepare(
    `SELECT t.name FROM tags t
       JOIN bookmark_tags bt ON bt.tag_id = t.id
      WHERE bt.bookmark_id = ?
      ORDER BY t.name COLLATE NOCASE`
  );
  const allTagsStmt = db.prepare(`SELECT name FROM tags ORDER BY name COLLATE NOCASE`);

  function getOrCreateTagId(name) {
    const found = findTagStmt.get(name);
    if (found) return found.id;
    return insertTagStmt.run(name).lastInsertRowid;
  }

  function setTags(bookmarkId, tags) {
    clearTagsStmt.run(bookmarkId);
    for (const name of normalizeTags(tags)) {
      linkTagStmt.run(bookmarkId, getOrCreateTagId(name));
    }
  }

  function enrich(row) {
    if (!row) return null;
    return {
      id: row.id,
      url: row.url,
      title: row.title,
      note: row.note || "",
      tags: tagsForStmt.all(row.id).map((r) => r.name),
      created_at: row.created_at,
    };
  }

  return {
    /** Look up an existing bookmark by normalized url, or null. */
    findByUrl(url) {
      return enrich(findByKeyStmt.get(normalizeUrlKey(url)));
    },

    /**
     * Create a bookmark. Title is assumed already resolved (auto-fetch happens
     * in the API layer); `url` is assumed already validated.
     */
    create({ url, title, note = "", tags = [], createdAt }) {
      const cleanUrl = url.trim();
      const finalTitle = title && title.trim() ? title.trim() : cleanUrl;
      const info = insertStmt.run({
        url: cleanUrl,
        title: finalTitle,
        note: note || "",
        url_key: normalizeUrlKey(cleanUrl),
        created_at: createdAt || new Date().toISOString(),
      });
      const id = info.lastInsertRowid;
      setTags(id, tags);
      return enrich(getByIdStmt.get(id));
    },

    getById(id) {
      return enrich(getByIdStmt.get(id));
    },

    /**
     * List bookmarks with optional full-text search and tag filter.
     * @param {{ q?: string, tag?: string, sort?: 'newest'|'oldest' }} [opts]
     */
    list({ q, tag, sort } = {}) {
      const where = [];
      const params = {};

      if (q && q.trim()) {
        params.q = `%${q.trim()}%`;
        where.push(
          `(b.title LIKE @q OR b.url LIKE @q OR b.note LIKE @q OR EXISTS (
             SELECT 1 FROM bookmark_tags bt JOIN tags t ON t.id = bt.tag_id
              WHERE bt.bookmark_id = b.id AND t.name LIKE @q))`
        );
      }
      if (tag && tag.trim()) {
        params.tag = tag.trim();
        where.push(
          `EXISTS (SELECT 1 FROM bookmark_tags bt JOIN tags t ON t.id = bt.tag_id
             WHERE bt.bookmark_id = b.id AND t.name = @tag COLLATE NOCASE)`
        );
      }

      const order = sort === "oldest" ? "ASC" : "DESC";
      const sql =
        `SELECT b.* FROM bookmarks b` +
        (where.length ? ` WHERE ${where.join(" AND ")}` : "") +
        ` ORDER BY b.created_at ${order}, b.id ${order}`;

      return db.prepare(sql).all(params).map(enrich);
    },

    /** Update url/title/note/tags. `patch` may contain any subset. */
    update(id, patch) {
      const current = getByIdStmt.get(id);
      if (!current) return null;

      const url = patch.url !== undefined ? patch.url.trim() : current.url;
      const title =
        patch.title !== undefined && patch.title.trim()
          ? patch.title.trim()
          : patch.title !== undefined
            ? url // title cleared -> fall back to url
            : current.title;
      const note = patch.note !== undefined ? patch.note || "" : current.note;

      updateStmt.run({ id, url, title, note, url_key: normalizeUrlKey(url) });
      if (patch.tags !== undefined) setTags(id, patch.tags);
      return enrich(getByIdStmt.get(id));
    },

    delete(id) {
      clearTagsStmt.run(id);
      return deleteStmt.run(id).changes > 0;
    },

    /** All tag names currently in use, for the filter control. */
    listTags() {
      return allTagsStmt.all().map((r) => r.name);
    },
  };
}
