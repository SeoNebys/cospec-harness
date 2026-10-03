import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTestDb } from '../../src/db/index.js';
import { getOrCreateTag, setBookmarkTags, tagsForBookmark, suggestTags } from '../../src/models/tag.js';
import { createBookmark } from '../../src/models/bookmark.js';

test('tag reuse is case-insensitive (FR-012)', () => {
  const db = createTestDb();
  const a = getOrCreateTag('Cooking', db);
  const b = getOrCreateTag('cooking', db);
  assert.equal(a.id, b.id, 'same tag reused regardless of case');
});

test('setBookmarkTags dedupes case-insensitively', () => {
  const db = createTestDb();
  const bm = createBookmark({ url: 'https://x.com', tags: ['Recipe', 'recipe', 'Food'] }, db);
  const tags = tagsForBookmark(bm.id, db);
  assert.equal(tags.length, 2);
});

test('suggestTags matches substring case-insensitively (FR-012)', () => {
  const db = createTestDb();
  getOrCreateTag('cooking', db);
  getOrCreateTag('books', db);
  const s = suggestTags('OOK', db);
  assert.ok(s.includes('cooking'));
  assert.ok(s.includes('books'));
});
