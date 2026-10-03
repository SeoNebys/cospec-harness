import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTestDb } from '../../src/db/index.js';
import { createBookmark, bulkApply, bulkCount, list } from '../../src/models/bookmark.js';
import { createView } from '../../src/models/savedView.js';

function seed(db, n, tag) {
  const ids = [];
  for (let i = 0; i < n; i++) {
    ids.push(createBookmark({ url: `https://s${tag}${i}.com`, title: `t${i}`, tags: [tag] }, db).id);
  }
  return ids;
}

test('select all matching honors complete view across pages (FR-025)', () => {
  const db = createTestDb();
  seed(db, 30, 'red');
  seed(db, 10, 'blue');
  // Also add an excluded overlap.
  const both = createBookmark({ url: 'https://both.com', tags: ['red', 'skip'] }, db);

  const selector = {
    matching: { included_tags: ['red'], excluded_tags: ['skip'], view: 'active' },
  };
  // 30 red minus the one that also has skip = 30.
  assert.equal(bulkCount(selector, db), 30);

  const affected = bulkApply(selector, { is_archived: true }, db);
  assert.equal(affected, 30);
  // The excluded one remains active.
  const active = list({ view: 'active' }, db);
  assert.ok(active.items.some((b) => b.id === both.id));
});

test('bulk count equals items changed (FR-027)', () => {
  const db = createTestDb();
  seed(db, 5, 'x');
  const selector = { matching: { included_tags: ['x'], view: 'active' } };
  const count = bulkCount(selector, db);
  const changed = bulkApply(selector, { is_read: true }, db);
  assert.equal(count, changed);
});

test('bulk from a saved view uses that exact view (FR-025a)', () => {
  const db = createTestDb();
  seed(db, 8, 'news');
  seed(db, 4, 'other');
  const view = createView({ name: 'News', query: '', included_tags: ['news'] }, db);

  const selector = { matching: { saved_view_id: view.id } };
  assert.equal(bulkCount(selector, db), 8);
  const affected = bulkApply(selector, { addTags: ['reviewed'] }, db);
  assert.equal(affected, 8);

  // Exactly the 8 news items got the new tag.
  const reviewed = list({ view: 'active', included_tags: ['reviewed'] }, db);
  assert.equal(reviewed.total, 8);
});

test('explicit ids selector', () => {
  const db = createTestDb();
  const ids = seed(db, 3, 'q');
  const affected = bulkApply({ ids: [ids[0], ids[1]] }, { is_read: true }, db);
  assert.equal(affected, 2);
});
