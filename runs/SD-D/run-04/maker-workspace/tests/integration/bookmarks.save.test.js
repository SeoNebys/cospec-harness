import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTestDb } from '../../src/db/index.js';
import { createBookmark, updateBookmark, getById } from '../../src/models/bookmark.js';

test('save then edit title/description/address persists overrides (FR-003)', () => {
  const db = createTestDb();
  const bm = createBookmark({ url: 'https://example.com/a', title: 'Auto' }, db);
  assert.equal(bm.title, 'Auto');
  const updated = updateBookmark(
    bm.id,
    { title: 'Mine', description: 'desc', url: 'https://example.com/b' },
    db
  );
  assert.equal(updated.title, 'Mine');
  assert.equal(updated.description, 'desc');
  assert.equal(updated.url, 'https://example.com/b');
  assert.equal(getById(bm.id, db).url, 'https://example.com/b');
});

test('missing title falls back to address (FR-005)', () => {
  const db = createTestDb();
  const bm = createBookmark({ url: 'https://example.com/x' }, db);
  assert.equal(bm.title, 'https://example.com/x');
});

test('new bookmarks default to unread (FR-021)', () => {
  const db = createTestDb();
  const bm = createBookmark({ url: 'https://example.com/y' }, db);
  assert.equal(bm.is_read, false);
});
