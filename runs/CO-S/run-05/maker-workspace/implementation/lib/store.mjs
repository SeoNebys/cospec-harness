import { DatabaseSync } from 'node:sqlite';

function mapBookmark(row, labels = []) {
  return {
    id: row.id,
    url: row.url,
    title: row.title,
    description: row.description,
    site: row.site,
    detailsStatus: row.details_status,
    readLater: Boolean(row.read_later),
    archived: Boolean(row.archived),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    labels
  };
}

export function createStore(filename = ':memory:') {
  const db = new DatabaseSync(filename);
  db.exec(`
    PRAGMA foreign_keys = ON;
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS bookmarks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      url TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      site TEXT NOT NULL,
      details_status TEXT NOT NULL DEFAULT 'ready' CHECK(details_status IN ('ready', 'needs_details')),
      read_later INTEGER NOT NULL DEFAULT 0 CHECK(read_later IN (0, 1)),
      archived INTEGER NOT NULL DEFAULT 0 CHECK(archived IN (0, 1)),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS labels (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL COLLATE NOCASE UNIQUE
    );
    CREATE TABLE IF NOT EXISTS bookmark_labels (
      bookmark_id INTEGER NOT NULL REFERENCES bookmarks(id) ON DELETE CASCADE,
      label_id INTEGER NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
      PRIMARY KEY (bookmark_id, label_id)
    );
    CREATE INDEX IF NOT EXISTS idx_bookmarks_archived ON bookmarks(archived);
    CREATE INDEX IF NOT EXISTS idx_bookmarks_read_later ON bookmarks(read_later);
  `);

  const statements = {
    byId: db.prepare('SELECT * FROM bookmarks WHERE id = ?'),
    byUrl: db.prepare('SELECT * FROM bookmarks WHERE url = ?'),
    labelsFor: db.prepare(`
      SELECT l.name FROM labels l
      JOIN bookmark_labels bl ON bl.label_id = l.id
      WHERE bl.bookmark_id = ? ORDER BY l.name COLLATE NOCASE
    `),
    insert: db.prepare(`
      INSERT INTO bookmarks (url, title, description, site, details_status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `),
    insertLabel: db.prepare('INSERT OR IGNORE INTO labels (name) VALUES (?)'),
    labelByName: db.prepare('SELECT id, name FROM labels WHERE name = ? COLLATE NOCASE'),
    attachLabel: db.prepare('INSERT OR IGNORE INTO bookmark_labels (bookmark_id, label_id) VALUES (?, ?)'),
    detachAll: db.prepare('DELETE FROM bookmark_labels WHERE bookmark_id = ?'),
    updateLater: db.prepare('UPDATE bookmarks SET read_later = ?, updated_at = ? WHERE id = ?'),
    archive: db.prepare('UPDATE bookmarks SET archived = 1, read_later = 0, updated_at = ? WHERE id = ?'),
    restore: db.prepare('UPDATE bookmarks SET archived = 0, read_later = 0, updated_at = ? WHERE id = ?'),
    updateDetails: db.prepare('UPDATE bookmarks SET title = ?, description = ?, details_status = ?, updated_at = ? WHERE id = ?')
  };

  function labelsFor(id) {
    return statements.labelsFor.all(id).map(row => row.name);
  }

  function get(id) {
    const row = statements.byId.get(id);
    return row ? mapBookmark(row, labelsFor(row.id)) : null;
  }

  function getByUrl(url) {
    const row = statements.byUrl.get(url);
    return row ? mapBookmark(row, labelsFor(row.id)) : null;
  }

  function add({ url, title, description = '', site, detailsStatus = 'ready' }) {
    const now = new Date().toISOString();
    const result = statements.insert.run(url, title, description, site, detailsStatus, now, now);
    return get(Number(result.lastInsertRowid));
  }

  function list({ view = 'all', query = '' } = {}) {
    const clauses = [];
    const values = [];
    if (view === 'archive') clauses.push('b.archived = 1');
    else {
      clauses.push('b.archived = 0');
      if (view === 'later') clauses.push('b.read_later = 1');
    }
    const trimmed = query.trim();
    if (trimmed) {
      const pattern = `%${trimmed}%`;
      clauses.push(`(
        b.title LIKE ? COLLATE NOCASE OR
        b.description LIKE ? COLLATE NOCASE OR
        b.site LIKE ? COLLATE NOCASE OR
        EXISTS (
          SELECT 1 FROM bookmark_labels sbl
          JOIN labels sl ON sl.id = sbl.label_id
          WHERE sbl.bookmark_id = b.id AND sl.name LIKE ? COLLATE NOCASE
        )
      )`);
      values.push(pattern, pattern, pattern, pattern);
    }
    const rows = db.prepare(`
      SELECT b.* FROM bookmarks b
      WHERE ${clauses.join(' AND ')}
      ORDER BY b.updated_at DESC, b.id DESC
    `).all(...values);
    return rows.map(row => mapBookmark(row, labelsFor(row.id)));
  }

  function addLabel(bookmarkId, rawName) {
    const bookmark = get(bookmarkId);
    if (!bookmark) return { kind: 'missing' };
    const name = rawName.trim();
    if (!name) return { kind: 'invalid' };
    const existing = bookmark.labels.find(label => label.toLocaleLowerCase() === name.toLocaleLowerCase());
    if (existing) return { kind: 'duplicate', bookmark };
    statements.insertLabel.run(name);
    const label = statements.labelByName.get(name);
    statements.attachLabel.run(bookmarkId, label.id);
    return { kind: 'added', bookmark: get(bookmarkId) };
  }

  function setReadLater(id, value) {
    const bookmark = get(id);
    if (!bookmark) return null;
    if (bookmark.archived && value) return bookmark;
    statements.updateLater.run(value ? 1 : 0, new Date().toISOString(), id);
    return get(id);
  }

  function setArchived(id, value) {
    if (!get(id)) return null;
    const now = new Date().toISOString();
    if (value) statements.archive.run(now, id);
    else statements.restore.run(now, id);
    return get(id);
  }

  function editDetails(id, { title, description }) {
    const bookmark = get(id);
    if (!bookmark) return null;
    const nextTitle = typeof title === 'string' && title.trim() ? title.trim() : bookmark.title;
    const nextDescription = typeof description === 'string' ? description.trim() : bookmark.description;
    statements.updateDetails.run(nextTitle, nextDescription, bookmark.detailsStatus, new Date().toISOString(), id);
    return get(id);
  }

  function replaceCollectedDetails(id, { title, description }) {
    const bookmark = get(id);
    if (!bookmark) return null;
    statements.updateDetails.run(title, description, 'ready', new Date().toISOString(), id);
    return get(id);
  }

  return {
    db,
    add,
    get,
    getByUrl,
    list,
    addLabel,
    setReadLater,
    setArchived,
    editDetails,
    replaceCollectedDetails,
    close: () => db.close()
  };
}
