import type { DB } from '../connection'

// Minimal forward-only migration runner. The schema is created idempotently in
// schema.ts; this tracks a version number so future schema changes can be
// applied in order without data loss.
interface Migration {
  version: number
  up: (db: DB) => void
}

const migrations: Migration[] = [
  // v1: the full-text index gained a bookmark_id column so matches map back to
  // bookmarks. Rebuild it and reindex any existing bookmarks.
  {
    version: 1,
    up: (db) => {
      db.exec(`
        DROP TABLE IF EXISTS bookmarks_fts;
        CREATE VIRTUAL TABLE bookmarks_fts USING fts5(
          bookmark_id UNINDEXED, title, description, note_text, tags, url
        );
        INSERT INTO bookmarks_fts (bookmark_id, title, description, note_text, tags, url)
          SELECT b.id, b.title, b.description, COALESCE(b.note_text, ''),
                 COALESCE((SELECT group_concat(t.name, ' ')
                             FROM tags t JOIN bookmark_tags bt ON bt.tag_id = t.id
                            WHERE bt.bookmark_id = b.id), ''),
                 b.url
            FROM bookmarks b;
      `)
    }
  },
  // v2: indexes that keep tag filtering and saved-copy lookups fast at scale
  // (SC-010, FR-035).
  {
    version: 2,
    up: (db) => {
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_bookmark_tags_tag ON bookmark_tags(tag_id);
        CREATE INDEX IF NOT EXISTS idx_saved_copies_bookmark ON saved_copies(bookmark_id);
      `)
    }
  }
]

export function runMigrations(db: DB): void {
  const current = (db.pragma('user_version', { simple: true }) as number) ?? 0
  const pending = migrations.filter((m) => m.version > current).sort((a, b) => a.version - b.version)
  for (const m of pending) {
    const tx = db.transaction(() => {
      m.up(db)
      db.pragma(`user_version = ${m.version}`)
    })
    tx()
  }
}
