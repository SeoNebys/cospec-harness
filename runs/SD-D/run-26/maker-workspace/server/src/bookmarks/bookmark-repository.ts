import { createHash, randomUUID } from 'node:crypto';
import type Database from 'better-sqlite3';
import type { Bookmark, BookmarkCreate, BookmarkUpdate, Collection } from '@shared/contracts.js';
import { normalizeTag } from '@shared/normalize.js';
import { urlKey } from '@shared/url.js';
import { searchDocument } from '../search/search-document.js';
import { parseQuery } from '../search/query-parser.js';
import { compileQuery } from '../search/query-compiler.js';

type Row = {
  id: string;
  url: string;
  title: string | null;
  description: string | null;
  note_markdown: string;
  icon_asset_id: string | null;
  icon_choice: Bookmark['iconChoice'];
  is_read: number;
  archived_at: string | null;
  metadata_status: string;
  created_at: string;
  updated_at: string;
};
export class BookmarkRepository {
  constructor(private db: Database.Database) {}
  private tags(id: string) {
    return this.db
      .prepare(
        `SELECT t.id,t.display_name name FROM tags t JOIN bookmark_tags bt ON bt.tag_id=t.id WHERE bt.bookmark_id=? ORDER BY t.normalized_name`
      )
      .all(id) as { id: string; name: string }[];
  }
  private map(row: Row): Bookmark {
    return {
      id: row.id,
      url: row.url,
      title: row.title,
      displayLabel: row.title?.trim() || row.url,
      description: row.description,
      noteMarkdown: row.note_markdown,
      tags: this.tags(row.id),
      isRead: !!row.is_read,
      archivedAt: row.archived_at,
      iconUrl: row.icon_asset_id ? `/api/icons/${row.icon_asset_id}` : null,
      iconChoice: row.icon_choice,
      metadataStatus: row.metadata_status,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
  get(id: string) {
    const row = this.db.prepare('SELECT * FROM bookmarks WHERE id=?').get(id) as Row | undefined;
    return row ? this.map(row) : null;
  }
  findByUrl(url: string) {
    const row = this.db.prepare('SELECT * FROM bookmarks WHERE url_key=?').get(urlKey(url)) as
      | Row
      | undefined;
    return row ? this.map(row) : null;
  }
  create(
    input: BookmarkCreate,
    metadata?: {
      title?: string | null;
      description?: string | null;
      iconAssetId?: string | null;
      createdAt?: string;
      updatedAt?: string;
      origin?: 'metadata' | 'import';
    }
  ) {
    const now = new Date().toISOString(),
      createdAt = metadata?.createdAt ?? now,
      updatedAt = metadata?.updatedAt ?? createdAt,
      id = randomUUID(),
      url = urlKey(input.url);
    const title = input.title === undefined ? (metadata?.title ?? null) : input.title;
    const description =
      input.description === undefined ? (metadata?.description ?? null) : input.description;
    const note = input.noteMarkdown ?? '';
    const s = searchDocument({ title, url, description, noteMarkdown: note });
    const tx = this.db.transaction(() => {
      this.db
        .prepare(
          `INSERT INTO bookmarks(id,url,url_key,title,description,note_markdown,icon_asset_id,icon_choice,title_origin,description_origin,is_read,metadata_status,metadata_fetched_at,created_at,updated_at,search_title,search_url,search_description,search_note) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
        )
        .run(
          id,
          url,
          url,
          title,
          description,
          note,
          metadata?.iconAssetId ?? null,
          metadata?.origin === 'import' && metadata.iconAssetId
            ? 'imported'
            : input.acceptIcon === false
              ? 'removed'
              : 'automatic',
          metadata?.origin === 'import'
            ? 'import'
            : input.title !== undefined
              ? 'user'
              : title
                ? 'metadata'
                : 'fallback',
          metadata?.origin === 'import'
            ? 'import'
            : input.description !== undefined
              ? 'user'
              : description
                ? 'metadata'
                : 'none',
          input.isRead ? 1 : 0,
          metadata?.origin === 'metadata' ? 'complete' : 'idle',
          metadata?.origin === 'metadata' ? now : null,
          createdAt,
          updatedAt,
          s.searchTitle,
          s.searchUrl,
          s.searchDescription,
          s.searchNote
        );
      this.setTags(id, input.tags ?? [], now);
      return this.get(id)!;
    });
    return tx();
  }
  private setTags(id: string, names: string[], now: string) {
    this.db.prepare('DELETE FROM bookmark_tags WHERE bookmark_id=?').run(id);
    for (const raw of names) {
      const name = raw.trim(),
        normalized = normalizeTag(name);
      let tag = this.db.prepare('SELECT id FROM tags WHERE normalized_name=?').get(normalized) as
        | { id: string }
        | undefined;
      if (!tag) {
        tag = { id: randomUUID() };
        this.db
          .prepare('INSERT INTO tags(id,display_name,normalized_name,created_at) VALUES(?,?,?,?)')
          .run(tag.id, name, normalized, now);
      }
      this.db
        .prepare('INSERT OR IGNORE INTO bookmark_tags(bookmark_id,tag_id) VALUES(?,?)')
        .run(id, tag.id);
    }
  }
  update(id: string, input: BookmarkUpdate, acceptedIconAssetId?: string | null) {
    const existing = this.get(id);
    if (!existing) return null;
    const now = new Date().toISOString(),
      url = input.url ? urlKey(input.url) : existing.url,
      title = input.title === undefined ? existing.title : input.title,
      description = input.description === undefined ? existing.description : input.description,
      note = input.noteMarkdown ?? existing.noteMarkdown;
    const s = searchDocument({ title, url, description, noteMarkdown: note });
    const archived =
      input.archived === undefined
        ? existing.archivedAt
        : input.archived
          ? (existing.archivedAt ?? now)
          : null;
    const tx = this.db.transaction(() => {
      const iconChoice = input.removeIcon
        ? 'removed'
        : acceptedIconAssetId
          ? 'automatic'
          : (input.iconChoice ?? existing.iconChoice);
      const iconAssetId = input.removeIcon
        ? null
        : acceptedIconAssetId !== undefined
          ? acceptedIconAssetId
          : undefined;
      this.db
        .prepare(
          `UPDATE bookmarks SET url=?,url_key=?,title=?,description=?,note_markdown=?,is_read=?,archived_at=?,icon_choice=?,icon_asset_id=COALESCE(?,icon_asset_id),updated_at=?,search_title=?,search_url=?,search_description=?,search_note=? WHERE id=?`
        )
        .run(
          url,
          url,
          title,
          description,
          note,
          input.isRead === undefined ? (existing.isRead ? 1 : 0) : input.isRead ? 1 : 0,
          archived,
          iconChoice,
          iconAssetId,
          now,
          s.searchTitle,
          s.searchUrl,
          s.searchDescription,
          s.searchNote,
          id
        );
      if (input.removeIcon)
        this.db.prepare('UPDATE bookmarks SET icon_asset_id=NULL WHERE id=?').run(id);
      if (input.tags) this.setTags(id, input.tags, now);
      return this.get(id);
    });
    return tx();
  }
  delete(id: string) {
    return this.db.prepare('DELETE FROM bookmarks WHERE id=?').run(id).changes > 0;
  }
  list(opts: {
    collection: Collection;
    query?: string;
    tag?: string;
    sort?: 'recent' | 'title';
    limit?: number;
    offset?: number;
  }) {
    const ast = parseQuery(opts.query ?? ''),
      compiled = compileQuery(ast);
    const scopes = {
      active: 'b.archived_at IS NULL',
      unread: 'b.archived_at IS NULL AND b.is_read=0',
      archive: 'b.archived_at IS NOT NULL'
    };
    let where = `${scopes[opts.collection]} AND (${compiled.sql})`;
    const params: any[] = [...compiled.params];
    if (opts.tag) {
      where += ` AND EXISTS (SELECT 1 FROM bookmark_tags fx JOIN tags ft ON ft.id=fx.tag_id WHERE fx.bookmark_id=b.id AND ft.normalized_name=?)`;
      params.push(normalizeTag(opts.tag));
    }
    const allIds = this.db
        .prepare(`SELECT b.id,b.updated_at FROM bookmarks b WHERE ${where} ORDER BY b.id`)
        .all(...params) as { id: string; updated_at: string }[],
      total = allIds.length,
      queryFingerprint = createHash('sha256')
        .update(
          JSON.stringify({
            collection: opts.collection,
            query: opts.query ?? '',
            tag: opts.tag ?? '',
            sort: opts.sort ?? 'recent',
            rows: allIds
          })
        )
        .digest('hex');
    const order =
      opts.sort === 'title' ? 'b.search_title ASC,b.id ASC' : 'b.updated_at DESC,b.id DESC';
    const rows = this.db
      .prepare(`SELECT b.* FROM bookmarks b WHERE ${where} ORDER BY ${order} LIMIT ? OFFSET ?`)
      .all(...params, Math.min(opts.limit ?? 50, 1000), opts.offset ?? 0) as Row[];
    return { items: rows.map((r) => this.map(r)), total, queryFingerprint };
  }
  counts() {
    return this.db
      .prepare(
        `SELECT count(*) FILTER(WHERE archived_at IS NULL) active,count(*) FILTER(WHERE archived_at IS NULL AND is_read=0) unread,count(*) FILTER(WHERE archived_at IS NOT NULL) archive FROM bookmarks`
      )
      .get() as { active: number; unread: number; archive: number };
  }
  allTags() {
    return this.db
      .prepare(
        `SELECT t.id,t.display_name name,count(bt.bookmark_id) count FROM tags t LEFT JOIN bookmark_tags bt ON bt.tag_id=t.id GROUP BY t.id ORDER BY t.normalized_name`
      )
      .all();
  }
  exportIcon(id: string) {
    return this.db
      .prepare(
        `SELECT i.mime_type mimeType,i.bytes,i.width,i.height FROM bookmarks b JOIN icon_assets i ON i.hash=b.icon_asset_id WHERE b.id=?`
      )
      .get(id) as { mimeType: string; bytes: Buffer; width: number; height: number } | undefined;
  }
  applyMissingMetadata(
    id: string,
    value: { title?: string | null; description?: string | null; iconAssetId?: string | null }
  ) {
    const b = this.get(id);
    if (!b) return null;
    const title = b.title ?? value.title ?? null,
      description = b.description ?? value.description ?? null;
    const s = searchDocument({ title, url: b.url, description, noteMarkdown: b.noteMarkdown }),
      now = new Date().toISOString();
    this.db
      .prepare(
        `UPDATE bookmarks SET title=?,description=?,icon_asset_id=COALESCE(icon_asset_id,?),title_origin=CASE WHEN title IS NULL AND ? IS NOT NULL THEN 'metadata' ELSE title_origin END,description_origin=CASE WHEN description IS NULL AND ? IS NOT NULL THEN 'metadata' ELSE description_origin END,metadata_status=?,metadata_fetched_at=?,updated_at=?,search_title=?,search_description=? WHERE id=?`
      )
      .run(
        title,
        description,
        value.iconAssetId ?? null,
        value.title ?? null,
        value.description ?? null,
        title || description || value.iconAssetId ? 'complete' : 'partial',
        now,
        now,
        s.searchTitle,
        s.searchDescription,
        id
      );
    return this.get(id);
  }
}
