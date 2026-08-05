'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { Store } = require('../src/store');

function tempFile() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bm-store-'));
  return path.join(dir, 'bookmarks.json');
}

test('starts empty when there is no file (SCN-005)', () => {
  const store = new Store(tempFile());
  assert.deepEqual(store.list(), []);
});

test('add puts newest first and persists (SCN-001)', () => {
  const store = new Store(tempFile());
  store.add({ url: 'https://a.com', title: 'A', nameStatus: 'found' });
  store.add({ url: 'https://b.com', title: 'B', nameStatus: 'found' });
  const list = store.list();
  assert.equal(list.length, 2);
  assert.equal(list[0].title, 'B'); // newest on top
  assert.equal(list[1].title, 'A');
  assert.ok(list[0].id && list[0].createdAt);
});

test('findByUrl matches ignoring scheme/slash/case (SCN-008)', () => {
  const store = new Store(tempFile());
  store.add({ url: 'https://Coffee.com/x/', title: 'C', nameStatus: 'found' });
  assert.ok(store.findByUrl('http://coffee.com/x'));
  assert.equal(store.findByUrl('https://other.com'), null);
});

test('rename sets a custom name and clears the fallback status (SCN-002/006)', () => {
  const store = new Store(tempFile());
  const b = store.add({ url: 'https://x.com', title: 'https://x.com', nameStatus: 'fallback' });
  const updated = store.rename(b.id, 'My name');
  assert.equal(updated.title, 'My name');
  assert.equal(updated.nameStatus, 'custom');
  assert.equal(store.rename('nope', 'x'), null);
});

test('remove returns the record and its position; restore puts it back (SCN-004)', () => {
  const store = new Store(tempFile());
  const a = store.add({ url: 'https://a.com', title: 'A', nameStatus: 'found' });
  const b = store.add({ url: 'https://b.com', title: 'B', nameStatus: 'found' });
  const c = store.add({ url: 'https://c.com', title: 'C', nameStatus: 'found' });
  // order: C, B, A  -> remove B (index 1)
  const removed = store.remove(b.id);
  assert.equal(removed.index, 1);
  assert.deepEqual(store.list().map((x) => x.title), ['C', 'A']);
  store.restore(removed.record, removed.index);
  assert.deepEqual(store.list().map((x) => x.title), ['C', 'B', 'A']); // back in place
  assert.equal(store.remove('missing'), null);
});

test('restore is idempotent and does not duplicate (SCN-004)', () => {
  const store = new Store(tempFile());
  const a = store.add({ url: 'https://a.com', title: 'A', nameStatus: 'found' });
  const removed = store.remove(a.id);
  store.restore(removed.record, removed.index);
  store.restore(removed.record, removed.index); // second undo click, no double insert
  assert.equal(store.list().length, 1);
});

test('data survives a restart: a new Store reads the same file (SCN-009)', () => {
  const file = tempFile();
  const s1 = new Store(file);
  s1.add({ url: 'https://keep.com', title: 'Keep me', nameStatus: 'custom' });
  const s2 = new Store(file); // simulates closing and reopening the app
  const list = s2.list();
  assert.equal(list.length, 1);
  assert.equal(list[0].title, 'Keep me');
  assert.equal(list[0].nameStatus, 'custom');
});

test('a corrupt store file is reported, not silently wiped (SCN-009)', () => {
  const file = tempFile();
  fs.writeFileSync(file, '{not valid json');
  assert.throws(() => new Store(file), /Could not read bookmarks store/);
});
