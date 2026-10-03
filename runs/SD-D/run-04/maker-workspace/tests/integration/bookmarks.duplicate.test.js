import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTestDb } from '../../src/db/index.js';
import { createBookmark, getRawByKey } from '../../src/models/bookmark.js';
import { normalizeKey } from '../../src/services/url.js';

test('normalized variants resolve to the same existing bookmark (FR-007/041)', () => {
  const db = createTestDb();
  const bm = createBookmark({ url: 'https://Example.com/path/' }, db);
  // A host-case + trailing-slash + default-port variant.
  const key = normalizeKey('https://example.com:443/path');
  const found = getRawByKey(key, db);
  assert.ok(found, 'variant matches existing');
  assert.equal(found.id, bm.id);
});

test('fragment/query differences are treated as different (FR-041)', () => {
  const db = createTestDb();
  createBookmark({ url: 'https://example.com/a' }, db);
  assert.equal(getRawByKey(normalizeKey('https://example.com/a#x'), db), undefined);
  assert.equal(getRawByKey(normalizeKey('https://example.com/a?q=1'), db), undefined);
});

test('archived match is still detected as duplicate (FR-008)', () => {
  const db = createTestDb();
  const bm = createBookmark({ url: 'https://example.com/z' }, db);
  db.prepare('UPDATE bookmarks SET is_archived = 1 WHERE id = ?').run(bm.id);
  const found = getRawByKey(normalizeKey('https://example.com/z'), db);
  assert.ok(found);
  assert.equal(found.is_archived, 1);
});
