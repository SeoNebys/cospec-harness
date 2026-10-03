import type { AppDatabase } from "../db/client.js";
import type { Bookmark, CreateBookmarkInput, UpdateBookmarkInput } from "../../shared/contracts/bookmarks.js";
import { decodeCursor, encodeCursor } from "../../shared/validation/bookmark-query.js";
import { BookmarkSearchRepository } from "./bookmark-search-repository.js";

type BookmarkRow = {
  id: number; url: string; title: string; title_source: Bookmark["titleSource"];
  notes: string | null; folder_id: number | null; folder_name: string | null; is_favorite: number;
  metadata_status: Bookmark["metadataStatus"]; metadata_failure_code: string | null;
  created_at: number; updated_at: number;
};

export type CreateRecord = CreateBookmarkInput & {
  normalizedUrl: string; resolvedTitle: string; titleSource: Bookmark["titleSource"];
  metadataStatus: Bookmark["metadataStatus"]; metadataFailureCode: string | null;
  iconAssetId: number | null; finalMetadataUrl: string | null;
};

export class BookmarkRepository {
  private readonly search: BookmarkSearchRepository;
  constructor(private readonly db: AppDatabase) { this.search = new BookmarkSearchRepository(db); }

  private map(userId: string, row: BookmarkRow): Bookmark {
    const tags = this.db.prepare(`SELECT t.id, t.name FROM tags t JOIN bookmark_tags bt ON bt.tag_id=t.id
      WHERE bt.bookmark_id=? AND bt.user_id=? ORDER BY t.name_key`).all(row.id, userId) as Array<{ id: number; name: string }>;
    return {
      id: row.id, url: row.url, title: row.title, titleSource: row.title_source, notes: row.notes,
      folder: row.folder_id && row.folder_name ? { id: row.folder_id, name: row.folder_name } : null,
      tags, isFavorite: Boolean(row.is_favorite), metadataStatus: row.metadata_status,
      metadataFailureCode: row.metadata_failure_code, iconUrl: `/api/bookmarks/${row.id}/icon`,
      createdAt: new Date(row.created_at).toISOString(), updatedAt: new Date(row.updated_at).toISOString()
    };
  }

  private baseSelect() {
    return `SELECT b.*, f.name AS folder_name FROM bookmarks b LEFT JOIN folders f ON f.id=b.folder_id AND f.user_id=b.user_id`;
  }

  find(userId: string, id: number): Bookmark | null {
    const row = this.db.prepare(`${this.baseSelect()} WHERE b.id=? AND b.user_id=?`).get(id, userId) as BookmarkRow | undefined;
    return row ? this.map(userId, row) : null;
  }

  findDuplicate(userId: string, normalizedUrl: string, excludeId?: number): Bookmark | null {
    const row = this.db.prepare(`${this.baseSelect()} WHERE b.user_id=? AND b.normalized_url=? ${excludeId ? "AND b.id<>?" : ""} ORDER BY b.created_at LIMIT 1`)
      .get(...(excludeId ? [userId, normalizedUrl, excludeId] : [userId, normalizedUrl])) as BookmarkRow | undefined;
    return row ? this.map(userId, row) : null;
  }

  create(userId: string, record: CreateRecord): Bookmark {
    const now = Date.now();
    const result = this.db.transaction(() => {
      this.assertRelationships(userId, record.folderId ?? null, record.tagIds ?? []);
      const insertion = this.db.prepare(`INSERT INTO bookmarks
        (user_id,url,normalized_url,final_metadata_url,title,title_sort,title_source,notes,folder_id,is_favorite,icon_asset_id,metadata_status,metadata_failure_code,metadata_fetched_at,created_at,updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
          userId, record.url.trim(), record.normalizedUrl, record.finalMetadataUrl, record.resolvedTitle,
          record.resolvedTitle.normalize("NFKC").toLocaleLowerCase("und"), record.titleSource,
          record.notes?.trim() || null, record.folderId ?? null, record.isFavorite ? 1 : 0,
          record.iconAssetId, record.metadataStatus, record.metadataFailureCode,
          record.metadataStatus === "pending" ? null : now, now, now
        );
      const id = Number(insertion.lastInsertRowid);
      this.replaceTags(id, userId, record.tagIds ?? []);
      this.search.refresh(id);
      return id;
    })();
    return this.find(userId, result)!;
  }

  list(userId: string, query: { q: string; folderId?: number; tagId?: number; favorite?: boolean; sort: "newest" | "oldest" | "title"; cursor?: string; limit: number }) {
    const conditions = ["b.user_id = ?"];
    const params: unknown[] = [userId];
    if (query.q) {
      if ([...query.q].length >= 3) {
        conditions.push(`EXISTS (SELECT 1 FROM bookmark_search
          WHERE bookmark_search.bookmark_id=CAST(b.id AS TEXT) AND bookmark_search.user_id=b.user_id
          AND bookmark_search MATCH ?)`);
        params.push(`"${query.q.replace(/"/g, '""')}"`);
      } else {
        const escaped = query.q.replace(/[\\%_]/g, "\\$&");
        conditions.push(`(b.title LIKE ? ESCAPE '\\' OR b.url LIKE ? ESCAPE '\\' OR EXISTS (
          SELECT 1 FROM bookmark_tags qbt JOIN tags qt ON qt.id=qbt.tag_id
          WHERE qbt.bookmark_id=b.id AND qbt.user_id=b.user_id AND qt.name LIKE ? ESCAPE '\\'))`);
        params.push(`%${escaped}%`, `%${escaped}%`, `%${escaped}%`);
      }
    }
    if (query.folderId) { conditions.push("b.folder_id = ?"); params.push(query.folderId); }
    if (query.tagId) { conditions.push("EXISTS (SELECT 1 FROM bookmark_tags fbt WHERE fbt.bookmark_id=b.id AND fbt.user_id=b.user_id AND fbt.tag_id=?)"); params.push(query.tagId); }
    if (query.favorite !== undefined) { conditions.push("b.is_favorite = ?"); params.push(query.favorite ? 1 : 0); }
    const sortColumn = query.sort === "title" ? "b.title_sort" : "b.created_at";
    const direction = query.sort === "oldest" || query.sort === "title" ? "ASC" : "DESC";
    if (query.cursor) {
      const cursor = decodeCursor(query.cursor);
      conditions.push(`(${sortColumn} ${direction === "ASC" ? ">" : "<"} ? OR (${sortColumn} = ? AND b.id ${direction === "ASC" ? ">" : "<"} ?))`);
      params.push(cursor.sortValue, cursor.sortValue, cursor.id);
    }
    const where = conditions.join(" AND ");
    const countParams = params.slice(0, query.cursor ? -3 : undefined);
    const total = (this.db.prepare(`SELECT count(*) AS count FROM bookmarks b WHERE ${query.cursor ? conditions.slice(0, -1).join(" AND ") : where}`)
      .get(...countParams) as { count: number }).count;
    const rows = this.db.prepare(`${this.baseSelect()} WHERE ${where} ORDER BY ${sortColumn} ${direction}, b.id ${direction} LIMIT ?`)
      .all(...params, query.limit + 1) as BookmarkRow[];
    const hasMore = rows.length > query.limit;
    const pageRows = rows.slice(0, query.limit);
    const last = pageRows.at(-1);
    const nextCursor = hasMore && last ? encodeCursor({ sortValue: query.sort === "title" ? last.title.toLocaleLowerCase("und") : last.created_at, id: last.id }) : null;
    return { items: pageRows.map((row) => this.map(userId, row)), nextCursor, total };
  }

  update(userId: string, id: number, changes: UpdateBookmarkInput & { normalizedUrl?: string; metadataFallbackTitle?: string }): Bookmark | null {
    const current = this.db.prepare("SELECT * FROM bookmarks WHERE id=? AND user_id=?").get(id, userId) as Record<string, unknown> | undefined;
    if (!current) return null;
    this.db.transaction(() => {
      this.assertRelationships(userId, changes.folderId === undefined ? current.folder_id as number | null : changes.folderId ?? null, changes.tagIds ?? this.tagIds(id, userId));
      const sets: string[] = []; const values: unknown[] = [];
      const set = (column: string, value: unknown) => { sets.push(`${column}=?`); values.push(value); };
      if (changes.url !== undefined) {
        set("url", changes.url.trim()); set("normalized_url", changes.normalizedUrl); set("metadata_status", "pending"); set("metadata_failure_code", null);
        if (changes.title === undefined && changes.metadataFallbackTitle) {
          set("title", changes.metadataFallbackTitle);
          set("title_sort", changes.metadataFallbackTitle.normalize("NFKC").toLocaleLowerCase("und"));
          set("title_source", "fallback");
        }
      }
      if (changes.title !== undefined) { set("title", changes.title); set("title_sort", changes.title.normalize("NFKC").toLocaleLowerCase("und")); set("title_source", "user"); }
      if (changes.notes !== undefined) set("notes", changes.notes?.trim() || null);
      if (changes.folderId !== undefined) set("folder_id", changes.folderId);
      if (sets.length) { set("updated_at", Date.now()); this.db.prepare(`UPDATE bookmarks SET ${sets.join(",")} WHERE id=? AND user_id=?`).run(...values, id, userId); }
      if (changes.tagIds !== undefined) this.replaceTags(id, userId, changes.tagIds);
      this.search.refresh(id);
    })();
    return this.find(userId, id);
  }

  setFavorite(userId: string, id: number, value: boolean): Bookmark | null {
    const result = this.db.prepare("UPDATE bookmarks SET is_favorite=?, updated_at=? WHERE id=? AND user_id=?").run(value ? 1 : 0, Date.now(), id, userId);
    return result.changes ? this.find(userId, id) : null;
  }

  delete(userId: string, id: number): boolean {
    return this.db.transaction(() => { this.search.remove(id); return this.db.prepare("DELETE FROM bookmarks WHERE id=? AND user_id=?").run(id, userId).changes > 0; })();
  }

  applyMetadata(userId: string, id: number, data: { title: string; titleSource: "page" | "fallback"; iconAssetId: number | null; status: Bookmark["metadataStatus"]; failureCode: string | null; finalUrl: string | null }): void {
    this.db.transaction(() => {
      this.db.prepare(`UPDATE bookmarks SET
        title=CASE WHEN title_source='fallback' THEN ? ELSE title END,
        title_sort=CASE WHEN title_source='fallback' THEN ? ELSE title_sort END,
        title_source=CASE WHEN title_source='fallback' THEN ? ELSE title_source END,
        icon_asset_id=COALESCE(?,icon_asset_id), metadata_status=?, metadata_failure_code=?, final_metadata_url=?, metadata_fetched_at=?, updated_at=?
        WHERE id=? AND user_id=?`).run(data.title, data.title.normalize("NFKC").toLocaleLowerCase("und"), data.titleSource, data.iconAssetId,
          data.status, data.failureCode, data.finalUrl, Date.now(), Date.now(), id, userId);
      this.search.refresh(id);
    })();
  }

  markPending(userId: string, id: number): boolean {
    return this.db.prepare("UPDATE bookmarks SET metadata_status='pending', metadata_failure_code=NULL, updated_at=? WHERE id=? AND user_id=?").run(Date.now(), id, userId).changes > 0;
  }

  stalePending(): Array<{ id: number; userId: string; url: string }> {
    return this.db.prepare("SELECT id, user_id AS userId, url FROM bookmarks WHERE metadata_status='pending' ORDER BY updated_at LIMIT 1").all() as Array<{ id: number; userId: string; url: string }>;
  }

  private tagIds(id: number, userId: string): number[] {
    return (this.db.prepare("SELECT tag_id AS id FROM bookmark_tags WHERE bookmark_id=? AND user_id=?").all(id, userId) as Array<{ id: number }>).map((row) => row.id);
  }
  private replaceTags(id: number, userId: string, tagIds: number[]): void {
    this.db.prepare("DELETE FROM bookmark_tags WHERE bookmark_id=? AND user_id=?").run(id, userId);
    const insert = this.db.prepare("INSERT INTO bookmark_tags (bookmark_id,tag_id,user_id) VALUES (?,?,?)");
    for (const tagId of [...new Set(tagIds)]) insert.run(id, tagId, userId);
  }
  private assertRelationships(userId: string, folderId: number | null, tagIds: number[]): void {
    if (folderId && !(this.db.prepare("SELECT 1 FROM folders WHERE id=? AND user_id=?").get(folderId, userId))) throw new Error("INVALID_FOLDER");
    if (tagIds.length) {
      const unique = [...new Set(tagIds)];
      const found = (this.db.prepare(`SELECT count(*) AS count FROM tags WHERE user_id=? AND id IN (${unique.map(() => "?").join(",")})`).get(userId, ...unique) as { count: number }).count;
      if (found !== unique.length) throw new Error("INVALID_TAG");
    }
  }
}
