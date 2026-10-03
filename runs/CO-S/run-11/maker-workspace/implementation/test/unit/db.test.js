'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { openDb, createDataStore } = require('../../src/db');
const { normalizeUrl } = require('../../src/url');

test('data store behaviour across scenarios', async (t) => {
  // One shared in-memory database, closed at the end. (Opening/closing many
  // better-sqlite3 handles under node:test can crash at teardown.)
  const store = createDataStore(openDb(':memory:'));
  // Close the handle and force finalizers to run while the environment is still
  // alive — avoids a native better-sqlite3 teardown crash under node:test.
  t.after(() => { store.db.close(); if (global.gc) { global.gc(); global.gc(); } });
  const reset = () => store.db.exec('DELETE FROM bookmark_tags; DELETE FROM bookmarks; DELETE FROM sessions; DELETE FROM users;');
  const add = (userId, url, extra = {}) => store.createBookmark(userId, {
    url, normUrl: normalizeUrl(url), title: extra.title || '', description: extra.description || '',
    note: extra.note || '', tags: extra.tags || [], finished: !!extra.finished, archived: !!extra.archived,
  });

  await t.test('users are isolated (SCN-013)', () => {
    reset();
    const u1 = store.createUser('a@x.com', 'h');
    const u2 = store.createUser('b@x.com', 'h');
    add(u1.id, 'https://one.com');
    assert.strictEqual(store.listBookmarks(u1.id).length, 1);
    assert.strictEqual(store.listBookmarks(u2.id).length, 0);
  });

  await t.test('createBookmark stores tags, note and reading state (SCN-002/008)', () => {
    reset();
    const u = store.createUser('a@x.com', 'h');
    const bm = add(u.id, 'https://one.com', { title: 'One', note: 'my note', tags: ['a', 'b', 'a'] });
    assert.deepStrictEqual(bm.tags, ['a', 'b']);
    assert.strictEqual(bm.note, 'my note');
    assert.strictEqual(bm.finished, false);
    assert.strictEqual(bm.archived, false);
  });

  await t.test('findByNormUrl detects duplicates (SCN-006)', () => {
    reset();
    const u = store.createUser('a@x.com', 'h');
    add(u.id, 'https://github.com/pallets/flask');
    assert.ok(store.findByNormUrl(u.id, normalizeUrl('https://GitHub.com/pallets/flask/')));
    assert.strictEqual(store.findByNormUrl(u.id, normalizeUrl('https://github.com/pallets/Flask')), null);
  });

  await t.test('update, status, archive and delete (SCN-007/003/011/012)', () => {
    reset();
    const u = store.createUser('a@x.com', 'h');
    const bm = add(u.id, 'https://one.com', { title: 'One' });
    const up = store.updateBookmark(u.id, bm.id, { url: 'https://one.com/new', normUrl: normalizeUrl('https://one.com/new'), title: 'Renamed', description: 'd', note: 'n', tags: ['x'] });
    assert.strictEqual(up.title, 'Renamed');
    assert.deepStrictEqual(up.tags, ['x']);
    assert.strictEqual(store.setFinished(u.id, bm.id, true).finished, true);
    assert.strictEqual(store.setArchived(u.id, bm.id, true).archived, true);
    assert.ok(store.deleteBookmark(u.id, bm.id));
    assert.strictEqual(store.listBookmarks(u.id).length, 0);
  });

  await t.test('listTags returns distinct tags for reuse (SCN-002)', () => {
    reset();
    const u = store.createUser('a@x.com', 'h');
    add(u.id, 'https://one.com', { tags: ['css', 'reference'] });
    add(u.id, 'https://two.com', { tags: ['css', 'reading'] });
    assert.deepStrictEqual(store.listTags(u.id), ['css', 'reading', 'reference']);
  });

  await t.test('sessions resolve and destroy (SCN-013)', () => {
    reset();
    const u = store.createUser('a@x.com', 'h');
    store.createSession('tok', u.id);
    assert.strictEqual(store.getSessionUser('tok').id, u.id);
    store.destroySession('tok');
    assert.strictEqual(store.getSessionUser('tok'), null);
  });
});
