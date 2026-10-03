import { getDb } from './connection.js';
import { getTagsForBookmark } from './tags.repo.js';
import { renderNotes } from '../lib/notes.js';

const SORT_SQL = {
  newest: 'date_added DESC',
  oldest: 'date_added ASC',
  title: 'title COLLATE NOCASE ASC',
  recently_modified: 'date_modified DESC',
};

export function sortClause(sort) {
  return SORT_SQL[sort] || SORT_SQL.newest;
}

// Serialize a DB row into the API bookmark object (contracts/api.md).
export function serialize(row) {
  if (!row) return null;
  return {
    id: row.id,
    url: row.url,
    title: row.title,
    description: row.description,
    iconUrl: row.icon_url,
    previewImageUrl: row.preview_image_url,
    notesMarkdown: row.notes_markdown,
    notesHtml: renderNotes(row.notes_markdown),
    tags: getTagsForBookmark(row.id),
    isRead: !!row.is_read,
    isArchived: !!row.is_archived,
    dateAdded: row.date_added,
    dateModified: row.date_modified,
    metadataStatus: row.metadata_status,
    preserved: {
      kind: row.preserved_kind,
      status: row.preserved_status,
      href: row.preserved_status === 'ready'
        ? `/api/bookmarks/${row.id}/preserve/local/file`
        : null,
    },
    archiveOrg: {
      status: row.archive_org_status,
      url: row.archive_org_url,
    },
  };
}

export function getById(id) {
  return getDb().prepare('SELECT * FROM bookmark WHERE id = ?').get(id);
}

export function create({ url, normalized, title, description = null, notesMarkdown = null }) {
  const now = new Date().toISOString();
  const info = getDb()
    .prepare(
      `INSERT INTO bookmark
        (url, normalized_url, title, description, notes_markdown,
         date_added, date_modified, metadata_status, preserved_status, archive_org_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', 'none', 'none')`
    )
    .run(url, normalized, title, description, notesMarkdown, now, now);
  return getById(info.lastInsertRowid);
}

// Create with explicit dates/status, used by import (preserve original date).
export function createImported({ url, normalized, title, dateAdded }) {
  const now = new Date().toISOString();
  const info = getDb()
    .prepare(
      `INSERT INTO bookmark
        (url, normalized_url, title, description, notes_markdown,
         date_added, date_modified, metadata_status, preserved_status, archive_org_status)
       VALUES (?, ?, ?, NULL, NULL, ?, ?, 'pending', 'none', 'none')`
    )
    .run(url, normalized, title, dateAdded || now, now);
  return getById(info.lastInsertRowid);
}

// Patch arbitrary columns; keys are DB column names. Always bumps date_modified.
export function updateFields(id, fields) {
  const cols = Object.keys(fields);
  if (cols.length === 0) return getById(id);
  const assignments = cols.map((c) => `${c} = ?`).join(', ');
  const values = cols.map((c) => fields[c]);
  getDb()
    .prepare(`UPDATE bookmark SET ${assignments}, date_modified = ? WHERE id = ?`)
    .run(...values, new Date().toISOString(), id);
  return getById(id);
}

// Set columns without touching date_modified (async metadata/preservation writes).
export function setSystemFields(id, fields) {
  const cols = Object.keys(fields);
  if (cols.length === 0) return;
  const assignments = cols.map((c) => `${c} = ?`).join(', ');
  const values = cols.map((c) => fields[c]);
  getDb().prepare(`UPDATE bookmark SET ${assignments} WHERE id = ?`).run(...values, id);
}

export function remove(id) {
  getDb().prepare('DELETE FROM bookmark WHERE id = ?').run(id);
}

// List for a view with optional tag filter, sort, and pagination.
export function list({ view = 'all', tag = null, sort = 'newest', page = 1, pageSize = 25 }) {
  const db = getDb();
  const where = [];
  const params = [];

  if (view === 'archive') {
    where.push('b.is_archived = 1');
  } else {
    where.push('b.is_archived = 0');
    if (view === 'unread') where.push('b.is_read = 0');
  }

  let join = '';
  if (tag) {
    join = `JOIN bookmark_tags bt ON bt.bookmark_id = b.id
            JOIN tag t ON t.id = bt.tag_id AND t.name = ? COLLATE NOCASE`;
    params.push(tag);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = db
    .prepare(`SELECT COUNT(DISTINCT b.id) AS n FROM bookmark b ${join} ${whereSql}`)
    .get(...params).n;

  const limit = Math.max(1, Number(pageSize) || 25);
  const offset = (Math.max(1, Number(page) || 1) - 1) * limit;
  const rows = db
    .prepare(
      `SELECT DISTINCT b.* FROM bookmark b ${join} ${whereSql}
       ORDER BY ${sortClause(sort).replace(/\b(date_added|date_modified|title)\b/g, 'b.$1')}
       LIMIT ? OFFSET ?`
    )
    .all(...params, limit, offset);

  return { items: rows.map(serialize), total };
}
