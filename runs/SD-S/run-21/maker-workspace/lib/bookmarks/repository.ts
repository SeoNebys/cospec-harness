import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { getDb } from "@/lib/db/client";
import { displayTag, normalizeTag } from "./normalize-tag";
import type { Bookmark, BookmarkInput, BookmarkQuery, Tag } from "./types";

type Row = Record<string, unknown>;
function tagsFor(db: DatabaseSync, id: string): Tag[] {
  return db
    .prepare(
      `SELECT t.id,t.name FROM tags t JOIN bookmark_tags bt ON bt.tag_id=t.id WHERE bt.bookmark_id=? ORDER BY t.name COLLATE NOCASE`
    )
    .all(id) as unknown as Tag[];
}
function map(db: DatabaseSync, r: Row): Bookmark {
  return {
    id: String(r.id),
    url: String(r.url),
    title: String(r.title),
    description: r.description as string | null,
    notes: r.notes as string | null,
    siteIconUrl: r.site_icon_url as string | null,
    previewImageUrl: r.preview_image_url as string | null,
    favorite: Boolean(r.favorite),
    readingStatus: r.reading_status as Bookmark["readingStatus"],
    archived: Boolean(r.archived_at),
    archivedAt: r.archived_at as string | null,
    tags: tagsFor(db, String(r.id)),
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at)
  };
}

export class BookmarkRepository {
  constructor(private db = getDb()) {}
  get(id: string) {
    const r = this.db.prepare("SELECT * FROM bookmarks WHERE id=?").get(id) as
      Row | undefined;
    return r ? map(this.db, r) : null;
  }
  duplicate(normalized: string, exceptId?: string) {
    const r = this.db
      .prepare(
        `SELECT * FROM bookmarks WHERE normalized_url=? ${exceptId ? "AND id<>?" : ""} ORDER BY created_at LIMIT 1`
      )
      .get(...(exceptId ? [normalized, exceptId] : [normalized])) as
      Row | undefined;
    return r ? map(this.db, r) : null;
  }
  create(input: BookmarkInput & { normalizedUrl: string }) {
    const id = randomUUID(),
      now = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO bookmarks(id,url,normalized_url,title,description,notes,site_icon_url,preview_image_url,favorite,reading_status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`
      )
      .run(
        id,
        input.url,
        input.normalizedUrl,
        input.title,
        input.description || null,
        input.notes || null,
        input.siteIconUrl || null,
        input.previewImageUrl || null,
        input.favorite ? 1 : 0,
        input.readingStatus || "to_read",
        now,
        now
      );
    this.replaceTags(id, input.tags || []);
    return this.get(id)!;
  }
  update(
    id: string,
    values: Partial<BookmarkInput> & { normalizedUrl?: string }
  ) {
    const current = this.get(id);
    if (!current) return null;
    const next = { ...current, ...values };
    const stored = this.db
      .prepare("SELECT normalized_url FROM bookmarks WHERE id=?")
      .get(id) as { normalized_url: string };
    this.db
      .prepare(
        `UPDATE bookmarks SET url=?,normalized_url=?,title=?,description=?,notes=?,site_icon_url=?,preview_image_url=?,favorite=?,reading_status=?,updated_at=? WHERE id=?`
      )
      .run(
        next.url,
        values.normalizedUrl ?? stored.normalized_url,
        next.title,
        next.description || null,
        next.notes || null,
        next.siteIconUrl || null,
        next.previewImageUrl || null,
        next.favorite ? 1 : 0,
        next.readingStatus,
        new Date().toISOString(),
        id
      );
    if (values.tags) this.replaceTags(id, values.tags);
    return this.get(id);
  }
  setArchived(id: string, archived: boolean) {
    const value = archived ? new Date().toISOString() : null;
    this.db
      .prepare("UPDATE bookmarks SET archived_at=?,updated_at=? WHERE id=?")
      .run(value, new Date().toISOString(), id);
    return this.get(id);
  }
  delete(id: string) {
    this.db.exec("BEGIN");
    try {
      const result = this.db
        .prepare("DELETE FROM bookmarks WHERE id=?")
        .run(id);
      this.removeOrphanTags();
      this.db.exec("COMMIT");
      return Number(result.changes) > 0;
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
  }
  replaceTags(bookmarkId: string, values: string[]) {
    const unique = new Map<string, string>(
      values
        .map((v) => [normalizeTag(v), displayTag(v)] as [string, string])
        .filter(([n]) => Boolean(n))
    );
    this.db.exec("BEGIN");
    try {
      this.db
        .prepare("DELETE FROM bookmark_tags WHERE bookmark_id=?")
        .run(bookmarkId);
      for (const [normalized, name] of unique) {
        let tag = this.db
          .prepare("SELECT id FROM tags WHERE normalized_name=?")
          .get(normalized) as { id: string } | undefined;
        if (!tag) {
          tag = { id: randomUUID() };
          this.db
            .prepare(
              "INSERT INTO tags(id,name,normalized_name,created_at) VALUES(?,?,?,?)"
            )
            .run(tag.id, name, normalized, new Date().toISOString());
        }
        this.db
          .prepare("INSERT INTO bookmark_tags(bookmark_id,tag_id) VALUES(?,?)")
          .run(bookmarkId, tag.id);
      }
      this.removeOrphanTags();
      this.db.exec("COMMIT");
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
  }
  removeOrphanTags() {
    this.db.exec(
      "DELETE FROM tags WHERE NOT EXISTS(SELECT 1 FROM bookmark_tags bt WHERE bt.tag_id=tags.id)"
    );
  }
  list(query: BookmarkQuery) {
    const where: string[] = [];
    const args: (string | number)[] = [];
    if (query.scope === "archived") where.push("b.archived_at IS NOT NULL");
    else where.push("b.archived_at IS NULL");
    if (query.scope === "to_read") where.push("b.reading_status='to_read'");
    if (query.scope === "favorites") where.push("b.favorite=1");
    if (query.favorite !== undefined) {
      where.push("b.favorite=?");
      args.push(query.favorite ? 1 : 0);
    }
    if (query.readingStatus) {
      where.push("b.reading_status=?");
      args.push(query.readingStatus);
    }
    if (query.tag) {
      where.push(
        "EXISTS(SELECT 1 FROM bookmark_tags bx JOIN tags tx ON tx.id=bx.tag_id WHERE bx.bookmark_id=b.id AND tx.normalized_name=?)"
      );
      args.push(normalizeTag(query.tag));
    }
    if (query.q) {
      const like = `%${query.q.toLocaleLowerCase()}%`;
      where.push(
        `(lower(b.title) LIKE ? OR lower(b.url) LIKE ? OR lower(coalesce(b.description,'')) LIKE ? OR lower(coalesce(b.notes,'')) LIKE ? OR EXISTS(SELECT 1 FROM bookmark_tags bs JOIN tags ts ON ts.id=bs.tag_id WHERE bs.bookmark_id=b.id AND lower(ts.name) LIKE ?))`
      );
      args.push(like, like, like, like, like);
    }
    const clause = where.join(" AND ");
    const order =
      query.sort === "title_asc"
        ? "b.title COLLATE NOCASE ASC,b.id ASC"
        : query.sort === "updated_desc"
          ? "b.updated_at DESC,b.id ASC"
          : "b.created_at DESC,b.id ASC";
    const total = Number(
      (
        this.db
          .prepare(`SELECT count(*) total FROM bookmarks b WHERE ${clause}`)
          .get(...args) as { total: number }
      ).total
    );
    const rows = this.db
      .prepare(
        `SELECT b.* FROM bookmarks b WHERE ${clause} ORDER BY ${order} LIMIT ? OFFSET ?`
      )
      .all(...args, query.pageSize, (query.page - 1) * query.pageSize) as Row[];
    return {
      items: rows.map((r) => map(this.db, r)),
      page: query.page,
      pageSize: query.pageSize,
      total
    };
  }
  tags() {
    return this.db
      .prepare(
        `SELECT t.id,t.name,count(bt.bookmark_id) bookmarkCount FROM tags t JOIN bookmark_tags bt ON bt.tag_id=t.id GROUP BY t.id ORDER BY t.name COLLATE NOCASE`
      )
      .all() as unknown as Tag[];
  }
}
