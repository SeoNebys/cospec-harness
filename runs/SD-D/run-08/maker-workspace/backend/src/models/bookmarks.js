import { stmt } from '../db/index.js';
import { getTagsForBookmark, setBookmarkTags } from './tags.js';
import { renderNote } from '../services/markdown.js';

const SORTS = {
  created_desc: 'b.created_at DESC, b.id DESC',
  created_asc: 'b.created_at ASC, b.id ASC',
  title_asc: 'b.title COLLATE NOCASE ASC, b.id ASC',
  title_desc: 'b.title COLLATE NOCASE DESC, b.id DESC',
};

export function sortClause(sort) {
  return SORTS[sort] || SORTS.created_desc;
}

/** Map a DB row to the API response shape (contracts/api.md). */
export function serialize(row) {
  if (!row) return null;
  const tags = getTagsForBookmark(row.id);
  return {
    id: row.id,
    url: row.url,
    title: row.title,
    description: row.description,
    note: row.note_md || null,
    noteHtml: row.note_md ? renderNote(row.note_md) : null,
    faviconUrl: row.favicon_path ? `/snapshots/${row.id}/${row.favicon_path}` : null,
    previewUrl: row.preview_path ? `/snapshots/${row.id}/${row.preview_path}` : null,
    snapshot: {
      kind: row.snapshot_kind,
      status: row.snapshot_status,
      url: row.snapshot_path ? `/snapshots/${row.id}/${row.snapshot_path}` : null,
    },
    archiveOrg: { status: row.archive_org_status, url: row.archive_org_url },
    tags,
    isUnread: !!row.is_unread,
    isArchived: !!row.is_archived,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function getRowById(id) {
  return stmt('SELECT * FROM bookmarks WHERE id = ?').get(id);
}

export function getById(id) {
  return serialize(getRowById(id));
}

export function getByUrlKey(urlKey) {
  return stmt('SELECT * FROM bookmarks WHERE url_key = ?').get(urlKey);
}

export function create({ url, urlKey, title, description, note, tags, createdAt }) {
  const now = new Date().toISOString();
  const info = stmt(
    `INSERT INTO bookmarks (url, url_key, title, description, note_md, created_at, updated_at)
       VALUES (@url, @urlKey, @title, @description, @note, @createdAt, @now)`
  ).run({
      url,
      urlKey,
      title: title || '',
      description: description || '',
      note: note || null,
      createdAt: createdAt || now,
      now,
    });
  const id = info.lastInsertRowid;
  if (tags && tags.length) setBookmarkTags(id, tags);
  return id;
}

const EDITABLE = ['url', 'url_key', 'title', 'description', 'note_md'];

export function updateFields(id, fields) {
  const sets = [];
  const params = { id, now: new Date().toISOString() };
  for (const [k, v] of Object.entries(fields)) {
    if (EDITABLE.includes(k)) {
      sets.push(`${k} = @${k}`);
      params[k] = v;
    }
  }
  sets.push('updated_at = @now');
  stmt(`UPDATE bookmarks SET ${sets.join(', ')} WHERE id = @id`).run(params);
  return getById(id);
}

export function setEnrichment(
  id,
  { title, description, faviconPath, previewPath, overrideTitle = true, overrideDescription = true }
) {
  const row = getRowById(id);
  if (!row) return;
  // Only fill title/description the user did not provide — user-entered values are
  // never clobbered by auto-collected ones (FR-004). Favicon/preview always update.
  stmt(
    `UPDATE bookmarks
     SET title = CASE WHEN @overrideTitle = 1 THEN COALESCE(NULLIF(@title, ''), title) ELSE title END,
         description = CASE WHEN @overrideDescription = 1 THEN COALESCE(NULLIF(@description, ''), description) ELSE description END,
         favicon_path = COALESCE(@faviconPath, favicon_path),
         preview_path = COALESCE(@previewPath, preview_path),
         updated_at = @now
     WHERE id = @id`
  ).run({
    id,
    title: title || '',
    description: description || '',
    faviconPath: faviconPath || null,
    previewPath: previewPath || null,
    overrideTitle: overrideTitle ? 1 : 0,
    overrideDescription: overrideDescription ? 1 : 0,
    now: new Date().toISOString(),
  });
}

export function setSnapshot(id, { path: snapPath, kind, status }) {
  stmt(
    `UPDATE bookmarks SET snapshot_path = @snapPath, snapshot_kind = @kind,
       snapshot_status = @status, updated_at = @now WHERE id = @id`
  ).run({ id, snapPath: snapPath || null, kind: kind || null, status, now: new Date().toISOString() });
}

export function setArchiveOrg(id, { url, status }) {
  stmt(
    `UPDATE bookmarks SET archive_org_url = @url, archive_org_status = @status,
       updated_at = @now WHERE id = @id`
  ).run({ id, url: url || null, status, now: new Date().toISOString() });
}

export function setReadState(id, unread) {
  stmt('UPDATE bookmarks SET is_unread = ?, updated_at = ? WHERE id = ?').run(
    unread ? 1 : 0,
    new Date().toISOString(),
    id
  );
  return getById(id);
}

export function setArchived(id, archived) {
  stmt('UPDATE bookmarks SET is_archived = ?, updated_at = ? WHERE id = ?').run(
    archived ? 1 : 0,
    new Date().toISOString(),
    id
  );
  return getById(id);
}

export function remove(id) {
  stmt('DELETE FROM bookmarks WHERE id = ?').run(id);
}

/**
 * Build the WHERE clause + params for list/bulk filtering (shared logic).
 * `matchIds` is an optional array of bookmark ids from a search query (null = no text search).
 */
function buildFilter({ includeTags, excludeTags, unread, archived, matchIds }) {
  const clauses = ['b.is_archived = ?'];
  const params = [archived ? 1 : 0];

  if (unread) clauses.push('b.is_unread = 1');

  if (matchIds) {
    if (matchIds.length === 0) return { where: '1 = 0', params: [] };
    clauses.push(`b.id IN (${matchIds.map(() => '?').join(',')})`);
    params.push(...matchIds);
  }

  for (const tag of includeTags || []) {
    clauses.push(
      `EXISTS (SELECT 1 FROM bookmark_tags bt JOIN tags t ON t.id = bt.tag_id
               WHERE bt.bookmark_id = b.id AND t.name = ? COLLATE NOCASE)`
    );
    params.push(tag);
  }
  for (const tag of excludeTags || []) {
    clauses.push(
      `NOT EXISTS (SELECT 1 FROM bookmark_tags bt JOIN tags t ON t.id = bt.tag_id
                   WHERE bt.bookmark_id = b.id AND t.name = ? COLLATE NOCASE)`
    );
    params.push(tag);
  }

  return { where: clauses.join(' AND '), params };
}

export function list(options) {
  const { sort, page = 1, pageSize = 25 } = options;
  const { where, params } = buildFilter(options);
  const total = stmt(`SELECT COUNT(*) AS n FROM bookmarks b WHERE ${where}`).get(...params).n;
  const offset = (Math.max(1, page) - 1) * pageSize;
  const rows = stmt(
    `SELECT b.* FROM bookmarks b WHERE ${where}
       ORDER BY ${sortClause(sort)} LIMIT ? OFFSET ?`
  ).all(...params, pageSize, offset);
  return { items: rows.map(serialize), total };
}

/** Resolve every bookmark id matching a filter (for view-wide bulk actions, FR-027). */
export function resolveIds(options) {
  const { where, params } = buildFilter(options);
  return stmt(`SELECT b.id FROM bookmarks b WHERE ${where}`)
    .all(...params)
    .map((r) => r.id);
}
