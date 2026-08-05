import type { DB } from '../db/connection';
import type { ExportFile, TagFilter } from '../../shared/types';
import { normalizeAndKey } from './url';

// Export / import the whole collection (FR-026..FR-030, SC-008).
// The export is an open, documented JSON document (contracts/rest-api.md). Import
// validates the file, then applies it in a single transaction so a bad file leaves
// the collection untouched (FR-030), merging by normalized url_key (FR-029) and
// preserving original saved/modified dates (FR-028).

interface BookmarkRow {
  id: number;
  url: string;
  title: string;
  description: string;
  notes: string;
  icon_url: string | null;
  image_url: string | null;
  read_later: number;
  archived: number;
  created_at: string;
  updated_at: string;
}

export function exportCollection(db: DB, exportedAt: string): ExportFile {
  const rows = db.prepare('SELECT * FROM bookmarks ORDER BY id ASC').all() as BookmarkRow[];
  const bookmarks = rows.map((r) => {
    const tags = db
      .prepare(
        `SELECT t.name FROM tags t JOIN bookmark_tags bt ON bt.tag_id = t.id
         WHERE bt.bookmark_id = ? ORDER BY t.name`
      )
      .all(r.id)
      .map((x) => (x as { name: string }).name);
    return {
      url: r.url,
      title: r.title,
      description: r.description,
      notes: r.notes,
      tags,
      readLater: r.read_later === 1,
      archived: r.archived === 1,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    } satisfies ExportFile['bookmarks'][number];
  });

  const savedSearches = (
    db
      .prepare('SELECT name, query_text, filter FROM saved_searches ORDER BY id ASC')
      .all() as Array<{
      name: string;
      query_text: string;
      filter: string;
    }>
  ).map((s) => ({
    name: s.name,
    queryText: s.query_text,
    filter: safeParseFilter(s.filter),
  }));

  return { format: 'bookmark-manager-export', version: 1, exportedAt, bookmarks, savedSearches };
}

function safeParseFilter(raw: string): TagFilter {
  try {
    const v = JSON.parse(raw);
    return v && typeof v === 'object' ? (v as TagFilter) : {};
  } catch {
    return {};
  }
}

export class InvalidImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidImportError';
  }
}

export interface ImportSummary {
  added: number;
  alreadyPresent: number;
  savedSearchesAdded: number;
}

/** Validate the shape of an import document, throwing InvalidImportError. */
function validate(doc: unknown): asserts doc is ExportFile {
  if (!doc || typeof doc !== 'object')
    throw new InvalidImportError('The file is not a valid export.');
  const d = doc as Record<string, unknown>;
  if (d.format !== 'bookmark-manager-export') {
    throw new InvalidImportError('This file is not a Bookmark Manager export.');
  }
  if (d.version !== 1)
    throw new InvalidImportError(`Unsupported export version: ${String(d.version)}.`);
  if (!Array.isArray(d.bookmarks))
    throw new InvalidImportError('The export is missing its bookmarks.');
  if (d.savedSearches !== undefined && !Array.isArray(d.savedSearches)) {
    throw new InvalidImportError('The export has malformed saved searches.');
  }
}

/**
 * Import a document. Merges by normalized url_key (existing bookmarks are not
 * duplicated; their tags are merged). New bookmarks keep their original dates
 * (FR-028). Runs in one transaction — any error rolls back everything (FR-030).
 */
export function importCollection(db: DB, doc: unknown): ImportSummary {
  validate(doc);

  const run = db.transaction((data: ExportFile): ImportSummary => {
    let added = 0;
    let alreadyPresent = 0;

    const findByKey = db.prepare('SELECT id FROM bookmarks WHERE url_key = ?');
    const insertBookmark = db.prepare(
      `INSERT INTO bookmarks (url, url_key, title, description, notes, read_later, archived, enrich_status, created_at, updated_at)
       VALUES (@url, @url_key, @title, @description, @notes, @read_later, @archived, 'done', @created_at, @updated_at)`
    );
    const insertTag = db.prepare('INSERT OR IGNORE INTO tags (name) VALUES (?)');
    const findTag = db.prepare('SELECT id FROM tags WHERE name = ?');
    const link = db.prepare(
      'INSERT OR IGNORE INTO bookmark_tags (bookmark_id, tag_id) VALUES (?, ?)'
    );
    const insertFts = db.prepare(
      `INSERT INTO bookmarks_fts (rowid, title, url, description, notes, tags)
       VALUES (?, ?, ?, ?, ?, ?)`
    );
    const deleteFts = db.prepare('DELETE FROM bookmarks_fts WHERE rowid = ?');

    const attachTags = (bookmarkId: number, tags: string[]): string[] => {
      const names = [...new Set((tags ?? []).map((t) => t.trim().toLowerCase()).filter(Boolean))];
      for (const name of names) {
        insertTag.run(name);
        const tag = findTag.get(name) as { id: number };
        link.run(bookmarkId, tag.id);
      }
      // Return the full current tag set for FTS sync.
      return (
        db
          .prepare(
            `SELECT t.name FROM tags t JOIN bookmark_tags bt ON bt.tag_id = t.id
             WHERE bt.bookmark_id = ? ORDER BY t.name`
          )
          .all(bookmarkId) as Array<{ name: string }>
      ).map((r) => r.name);
    };

    const syncFts = (
      id: number,
      b: { title: string; url: string; description: string; notes: string },
      tags: string[]
    ) => {
      deleteFts.run(id);
      insertFts.run(id, b.title, b.url, b.description, b.notes, tags.join(' '));
    };

    for (const item of data.bookmarks) {
      if (!item || typeof item.url !== 'string') {
        throw new InvalidImportError('An exported bookmark is missing its address.');
      }
      const { url, key } = normalizeAndKey(item.url);
      const existing = findByKey.get(key) as { id: number } | undefined;

      if (existing) {
        alreadyPresent++;
        const tags = attachTags(existing.id, item.tags ?? []);
        const row = db
          .prepare('SELECT title, url, description, notes FROM bookmarks WHERE id = ?')
          .get(existing.id) as {
          title: string;
          url: string;
          description: string;
          notes: string;
        };
        syncFts(existing.id, row, tags);
      } else {
        const info = insertBookmark.run({
          url,
          url_key: key,
          title: (item.title ?? '').trim() || url,
          description: item.description ?? '',
          notes: item.notes ?? '',
          read_later: item.readLater ? 1 : 0,
          archived: item.archived ? 1 : 0,
          // Preserve original dates (FR-028); fall back to export time only if absent.
          created_at: item.createdAt ?? data.exportedAt,
          updated_at: item.updatedAt ?? item.createdAt ?? data.exportedAt,
        });
        const id = Number(info.lastInsertRowid);
        const tags = attachTags(id, item.tags ?? []);
        syncFts(
          id,
          {
            title: (item.title ?? '').trim() || url,
            url,
            description: item.description ?? '',
            notes: item.notes ?? '',
          },
          tags
        );
        added++;
      }
    }

    let savedSearchesAdded = 0;
    const insertSaved = db.prepare(
      'INSERT INTO saved_searches (name, query_text, filter, created_at) VALUES (?, ?, ?, ?)'
    );
    for (const s of data.savedSearches ?? []) {
      if (!s || typeof s.name !== 'string') continue;
      insertSaved.run(s.name, s.queryText ?? '', JSON.stringify(s.filter ?? {}), data.exportedAt);
      savedSearchesAdded++;
    }

    return { added, alreadyPresent, savedSearchesAdded };
  });

  return run(doc as ExportFile);
}
