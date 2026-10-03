// T012 / T017: Bookmark data-access. CRUD plus list with tags.
import db from '../db/connection.js';

const now = () => new Date().toISOString();

const SORTS = {
  date_added_desc: 'b.date_added DESC, b.id DESC',
  date_added_asc: 'b.date_added ASC, b.id ASC',
  title_asc: 'b.title COLLATE NOCASE ASC, b.id ASC',
  title_desc: 'b.title COLLATE NOCASE DESC, b.id DESC',
};

function tagsFor(bookmarkId) {
  return db
    .prepare(
      `SELECT t.name FROM tags t
       JOIN bookmark_tags bt ON bt.tag_id = t.id
       WHERE bt.bookmark_id = ?
       ORDER BY t.name COLLATE NOCASE`
    )
    .all(bookmarkId)
    .map((r) => r.name);
}

function hydrate(row) {
  if (!row) return null;
  return {
    id: row.id,
    url: row.url,
    title: row.title,
    description: row.description,
    note: row.note,
    icon_url: row.icon_url,
    preview_image: row.preview_image,
    is_read: !!row.is_read,
    is_archived: !!row.is_archived,
    date_added: row.date_added,
    date_modified: row.date_modified,
    tags: tagsFor(row.id),
  };
}

export function getById(id) {
  return hydrate(db.prepare('SELECT * FROM bookmarks WHERE id = ?').get(id));
}

export function getByUrl(url) {
  return hydrate(db.prepare('SELECT * FROM bookmarks WHERE url = ?').get(url));
}

export function create({
  url,
  title = '',
  description = '',
  note = '',
  icon_url = '',
  preview_image = '',
  date_added,
  date_modified,
}) {
  const ts = now();
  const added = date_added || ts;
  const modified = date_modified || added;
  const info = db
    .prepare(
      `INSERT INTO bookmarks
         (url, title, description, note, icon_url, preview_image, date_added, date_modified)
       VALUES (@url, @title, @description, @note, @icon_url, @preview_image, @added, @modified)`
    )
    .run({ url, title, description, note, icon_url, preview_image, added, modified });
  return getById(info.lastInsertRowid);
}

const UPDATABLE = ['title', 'description', 'url', 'note', 'icon_url', 'preview_image'];

export function update(id, fields) {
  const sets = [];
  const params = { id, ts: now() };
  for (const key of UPDATABLE) {
    if (Object.prototype.hasOwnProperty.call(fields, key)) {
      sets.push(`${key} = @${key}`);
      params[key] = fields[key];
    }
  }
  if (sets.length) {
    sets.push('date_modified = @ts');
    db.prepare(`UPDATE bookmarks SET ${sets.join(', ')} WHERE id = @id`).run(params);
  }
  return getById(id);
}

/**
 * All bookmarks for a view (no pagination), hydrated with tags and ordered.
 * Callers apply tag/search filtering and pagination on top (route layer).
 * @param {{view?:string, sort?:string}} opts
 */
export function allForView({ view = 'all', sort = 'date_added_desc' } = {}) {
  const where = [];
  if (view === 'archive') where.push('b.is_archived = 1');
  else where.push('b.is_archived = 0');
  if (view === 'unread') where.push('b.is_read = 0');

  const orderBy = SORTS[sort] || SORTS.date_added_desc;
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const rows = db
    .prepare(`SELECT * FROM bookmarks b ${whereSql} ORDER BY ${orderBy}`)
    .all();
  return rows.map(hydrate);
}

export function setReadStatus(id, isRead) {
  db.prepare('UPDATE bookmarks SET is_read = ?, date_modified = ? WHERE id = ?').run(
    isRead ? 1 : 0,
    now(),
    id
  );
  return getById(id);
}

export function setArchivedStatus(id, isArchived) {
  db.prepare('UPDATE bookmarks SET is_archived = ?, date_modified = ? WHERE id = ?').run(
    isArchived ? 1 : 0,
    now(),
    id
  );
  return getById(id);
}

export function remove(id) {
  return db.prepare('DELETE FROM bookmarks WHERE id = ?').run(id).changes > 0;
}
