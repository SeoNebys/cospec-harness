'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { Store } = require('../../src/store');
const { sameLink } = require('../../src/urls');

function tmpStore() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bm-store-'));
  return new Store(path.join(dir, 'db.json'));
}

test('account lifecycle (SCN-011)', () => {
  const s = tmpStore();
  assert.strictEqual(s.accountExists(), false);
  s.createAccount('me@example.com', 'hash');
  assert.strictEqual(s.accountExists(), true);
  assert.strictEqual(s.getAccount().email, 'me@example.com');
});

test('sessions expire and can be destroyed (SCN-011)', () => {
  const s = tmpStore();
  const persistent = s.createSession(60000);
  assert.ok(s.getSession(persistent));
  s.destroySession(persistent);
  assert.strictEqual(s.getSession(persistent), null);

  const expired = s.createSession(-1); // already in the past
  assert.strictEqual(s.getSession(expired), null);
});

test('bookmarks add/find/update/delete (SCN-001,004,005,008)', () => {
  const s = tmpStore();
  const a = s.addBookmark({ url: 'https://a.com', title: 'A', topic: 'X' });
  assert.strictEqual(s.listBookmarks().length, 1);

  const found = s.findByUrl(sameLink, 'a.com/');
  assert.ok(found && found.id === a.id, 'finds by normalized address');

  const updated = s.updateBookmark(a.id, { url: 'https://a.com', title: 'A2', topic: 'Y' });
  assert.strictEqual(updated.title, 'A2');
  assert.strictEqual(updated.topic, 'Y');

  assert.strictEqual(s.deleteBookmark(a.id), true);
  assert.strictEqual(s.listBookmarks().length, 0);
  assert.strictEqual(s.deleteBookmark(a.id), false);
});

test('data persists across store instances (SCN-011 central storage)', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bm-store-'));
  const file = path.join(dir, 'db.json');
  const s1 = new Store(file);
  s1.createAccount('me@example.com', 'hash');
  s1.addBookmark({ url: 'https://a.com', title: 'A', topic: 'X' });
  const s2 = new Store(file);
  assert.strictEqual(s2.accountExists(), true);
  assert.strictEqual(s2.listBookmarks().length, 1);
});
