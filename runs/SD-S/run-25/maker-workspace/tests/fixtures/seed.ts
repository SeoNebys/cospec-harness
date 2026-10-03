import path from 'node:path';

import type { ReadingState } from '../../src/shared/contracts.js';
import {
  closeDatabase,
  openDatabase,
  type BookmarkDatabase,
} from '../../src/server/db/connection.js';
import { runMigrations } from '../../src/server/db/migrations.js';

export const PERFORMANCE_BOOKMARK_COUNT = 1_000;
export const PERFORMANCE_DATABASE_PATH = path.resolve(
  process.cwd(),
  '.tmp/e2e.sqlite',
);
export const KNOWN_BOOKMARK_INDEX = 777;
export const KNOWN_BOOKMARK_TITLE = 'Needle performance bookmark';
export const KNOWN_BOOKMARK_URL = 'https://performance.example.test/reference/0777';
export const KNOWN_BOOKMARK_QUERY = 'needle performance';
export const PERFORMANCE_FILTER_TAG = 'Cohort 07';
export const PERFORMANCE_FILTER_TAG_NORMALIZED = 'cohort 07';
export const PERFORMANCE_FILTER_COUNT = 100;

interface SeedBookmark {
  id: string;
  url: string;
  title: string;
  description: string;
  readingState: ReadingState;
  createdAt: string;
  tags: readonly string[];
}

export interface PerformanceSeedResult {
  bookmarkCount: number;
  knownBookmarkId: string;
  knownBookmarkTitle: string;
  filterTag: string;
  filterCount: number;
}

function deterministicId(namespace: 1 | 2, value: number): string {
  return `${namespace}0000000-0000-4000-8000-${value.toString().padStart(12, '0')}`;
}

function bookmarkAt(index: number): SeedBookmark {
  const suffix = index.toString().padStart(4, '0');
  const isKnownBookmark = index === KNOWN_BOOKMARK_INDEX;
  const cohort = `Cohort ${(index % 10).toString().padStart(2, '0')}`;
  const readingState: ReadingState =
    index % 3 === 0 ? 'to_read' : index % 3 === 1 ? 'untracked' : 'read';

  return {
    id: deterministicId(1, index + 1),
    url: `https://performance.example.test/reference/${suffix}`,
    title: isKnownBookmark ? KNOWN_BOOKMARK_TITLE : `Reference bookmark ${suffix}`,
    description: isKnownBookmark
      ? 'A uniquely identifiable bookmark used to verify known-item retrieval.'
      : `Deterministic performance fixture number ${suffix}.`,
    readingState,
    createdAt: new Date(Date.UTC(2025, 0, 1) + index * 60_000).toISOString(),
    tags: [cohort, 'Performance', index % 2 === 0 ? 'Even' : 'Odd'],
  };
}

function clearLibrary(database: BookmarkDatabase): void {
  database.transaction(() => {
    database.prepare('DELETE FROM bookmark_tags').run();
    database.prepare('DELETE FROM bookmarks').run();
    database.prepare('DELETE FROM tags').run();
  })();
}

/**
 * Replace the E2E library with a stable 1,000-row data set in one transaction.
 * A second SQLite connection is safe here because the app database uses WAL
 * and the browser has not started a list request yet.
 */
export function seedPerformanceDatabase(
  databasePath = PERFORMANCE_DATABASE_PATH,
  count = PERFORMANCE_BOOKMARK_COUNT,
): PerformanceSeedResult {
  if (!Number.isSafeInteger(count) || count <= KNOWN_BOOKMARK_INDEX) {
    throw new RangeError(`Performance seed count must exceed ${KNOWN_BOOKMARK_INDEX}.`);
  }

  const database = openDatabase(databasePath);
  try {
    runMigrations(database);
    const bookmarks = Array.from({ length: count }, (_, index) => bookmarkAt(index));
    const displayTags = [...new Set(bookmarks.flatMap(({ tags }) => tags))];

    database.transaction(() => {
      database.prepare('DELETE FROM bookmark_tags').run();
      database.prepare('DELETE FROM bookmarks').run();
      database.prepare('DELETE FROM tags').run();

      const insertTag = database.prepare(
        'INSERT INTO tags (id, display_name, normalized_name) VALUES (?, ?, ?)',
      );
      const tagIds = new Map<string, string>();
      displayTags.forEach((displayName, index) => {
        const normalizedName = displayName.toLowerCase();
        const id = deterministicId(2, index + 1);
        tagIds.set(normalizedName, id);
        insertTag.run(id, displayName, normalizedName);
      });

      const insertBookmark = database.prepare(
        `INSERT INTO bookmarks
         (id, url, url_key, title, description, reading_state, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      );
      const attachTag = database.prepare(
        'INSERT INTO bookmark_tags (bookmark_id, tag_id) VALUES (?, ?)',
      );

      for (const bookmark of bookmarks) {
        insertBookmark.run(
          bookmark.id,
          bookmark.url,
          bookmark.url,
          bookmark.title,
          bookmark.description,
          bookmark.readingState,
          bookmark.createdAt,
          bookmark.createdAt,
        );
        for (const displayName of bookmark.tags) {
          attachTag.run(bookmark.id, tagIds.get(displayName.toLowerCase()));
        }
      }
    })();

    const seededCount = (
      database.prepare('SELECT COUNT(*) AS count FROM bookmarks').get() as {
        count: number;
      }
    ).count;
    if (seededCount !== count) {
      throw new Error(`Expected ${count} seeded bookmarks, found ${seededCount}.`);
    }

    return {
      bookmarkCount: seededCount,
      knownBookmarkId: deterministicId(1, KNOWN_BOOKMARK_INDEX + 1),
      knownBookmarkTitle: KNOWN_BOOKMARK_TITLE,
      filterTag: PERFORMANCE_FILTER_TAG,
      filterCount: bookmarks.filter(({ tags }) => tags.includes(PERFORMANCE_FILTER_TAG))
        .length,
    };
  } finally {
    closeDatabase(database);
  }
}

/** Leave the shared E2E database small for scenarios that run after this one. */
export function clearPerformanceDatabase(
  databasePath = PERFORMANCE_DATABASE_PATH,
): void {
  const database = openDatabase(databasePath, { fileMustExist: true });
  try {
    clearLibrary(database);
  } finally {
    closeDatabase(database);
  }
}
