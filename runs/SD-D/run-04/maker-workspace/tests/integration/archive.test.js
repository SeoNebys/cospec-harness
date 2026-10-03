import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTestDb } from '../../src/db/index.js';
import { createBookmark, updateBookmark, list } from '../../src/models/bookmark.js';

test('archived excluded from active/search/unread; present in archive; restore intact (FR-020/023/024, SC-009)', () => {
  const db = createTestDb();
  const keep = createBookmark({ url: 'https://a.com', title: 'Keep', tags: ['t'] }, db);
  const arch = createBookmark({ url: 'https://b.com', title: 'Archive me', tags: ['t'] }, db);
  updateBookmark(arch.id, { is_archived: true }, db);

  const active = list({ view: 'active' }, db);
  assert.equal(active.items.length, 1);
  assert.equal(active.items[0].id, keep.id);

  // Search must not surface archived.
  const searched = list({ view: 'active', q: 'Archive' }, db);
  assert.equal(searched.items.length, 0);

  // Tag filter must not surface archived.
  const byTag = list({ view: 'active', included_tags: ['t'] }, db);
  assert.equal(byTag.items.length, 1);

  // Unread view excludes archived.
  const unread = list({ view: 'unread' }, db);
  assert.equal(unread.items.every((b) => b.id !== arch.id), true);

  // Archive view shows it.
  const archived = list({ view: 'archive' }, db);
  assert.equal(archived.items.length, 1);
  assert.equal(archived.items[0].id, arch.id);

  // Restore keeps tags.
  const restored = updateBookmark(arch.id, { is_archived: false }, db);
  assert.deepEqual(restored.tags, ['t']);
  assert.equal(list({ view: 'active' }, db).items.length, 2);
});
