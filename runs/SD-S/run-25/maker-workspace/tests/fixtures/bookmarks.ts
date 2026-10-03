import type { Bookmark, BookmarkInput } from '../../src/shared/contracts.js';

export const FIXED_NOW = '2026-09-26T12:00:00.000Z';
export const FIXED_BOOKMARK_ID = '00000000-0000-4000-8000-000000000001';

export function createDeterministicClock(
  start = FIXED_NOW,
  stepMilliseconds = 1_000,
): () => string {
  let next = Date.parse(start);

  if (!Number.isFinite(next)) throw new TypeError('Clock start must be an ISO date.');

  return () => {
    const current = new Date(next).toISOString();
    next += stepMilliseconds;
    return current;
  };
}

export function createDeterministicUuidFactory(start = 1): () => string {
  let next = start;

  if (!Number.isSafeInteger(next) || next < 0) {
    throw new TypeError('UUID sequence start must be a non-negative safe integer.');
  }

  return () => {
    const suffix = next.toString(16).padStart(12, '0');
    next += 1;
    return `00000000-0000-4000-8000-${suffix}`;
  };
}

export function buildBookmarkInput(
  overrides: Partial<BookmarkInput> = {},
): BookmarkInput {
  return {
    url: 'https://example.com/articles/testing',
    title: 'A representative bookmark',
    description: 'A useful page saved for later.',
    tags: ['Research', 'Testing'],
    readingState: 'to_read',
    allowDuplicate: false,
    ...overrides,
  };
}

export function buildBookmark(overrides: Partial<Bookmark> = {}): Bookmark {
  return {
    id: FIXED_BOOKMARK_ID,
    url: 'https://example.com/articles/testing',
    title: 'A representative bookmark',
    description: 'A useful page saved for later.',
    tags: ['Research', 'Testing'],
    readingState: 'to_read',
    createdAt: FIXED_NOW,
    updatedAt: FIXED_NOW,
    ...overrides,
  };
}
