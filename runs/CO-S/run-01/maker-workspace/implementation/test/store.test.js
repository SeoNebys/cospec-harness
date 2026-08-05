// Integration tests for the JSON-file store: CRUD, dedup, and persistence.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { Store } = require('../src/store');

function tmpFile() {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'bm-')), 'bookmarks.json');
}

test('create fills defaults and puts newest first (SCN-001)', () => {
  const store = new Store(tmpFile());
  const a = store.create({ url: 'https://nytimes.com/kyoto', title: 'Kyoto' });
  const b = store.create({ url: 'https://github.com/x', title: null, needsTitle: true });
  assert.ok(a.id && b.id);
  assert.equal(a.host, 'nytimes.com');
  assert.equal(a.title, 'Kyoto');
  assert.equal(b.needsTitle, true);
  assert.equal(b.title, 'Github'); // fallback site name when no title
  const list = store.list();
  assert.equal(list[0].id, b.id); // newest first
  assert.equal(list.length, 2);
});

test('findByUrl detects duplicates by canonical URL (SCN-006)', () => {
  const store = new Store(tmpFile());
  store.create({ url: 'https://www.nytimes.com/kyoto/', title: 'Kyoto' });
  assert.ok(store.findByUrl('http://nytimes.com/kyoto'));
  assert.equal(store.findByUrl('https://example.com'), null);
});

test('update sets a name and clears needsTitle (SCN-006 add-a-name)', () => {
  const store = new Store(tmpFile());
  const b = store.create({ url: 'https://x.com', title: null, needsTitle: true });
  const updated = store.update(b.id, { title: 'My name for it' });
  assert.equal(updated.title, 'My name for it');
  assert.equal(updated.needsTitle, false);
});

test('update de-duplicates and trims tags (SCN-004)', () => {
  const store = new Store(tmpFile());
  const b = store.create({ url: 'https://x.com', title: 'X' });
  const updated = store.update(b.id, { tags: ['  Travel ', 'Travel', '', 'Japan'] });
  assert.deepEqual(updated.tags, ['Travel', 'Japan']);
});

test('remove deletes a bookmark (SCN-008)', () => {
  const store = new Store(tmpFile());
  const b = store.create({ url: 'https://x.com', title: 'X' });
  assert.equal(store.remove(b.id), true);
  assert.equal(store.list().length, 0);
  assert.equal(store.remove('nope'), false);
});

test('data persists across store instances (NF-2)', () => {
  const file = tmpFile();
  const s1 = new Store(file);
  const b = s1.create({ url: 'https://x.com', title: 'X', tags: ['Tech'] });
  const s2 = new Store(file); // reload from disk
  const reloaded = s2.get(b.id);
  assert.ok(reloaded);
  assert.equal(reloaded.title, 'X');
  assert.deepEqual(reloaded.tags, ['Tech']);
});

test('a fresh/empty file yields an empty library (SCN-005)', () => {
  const store = new Store(tmpFile());
  assert.deepEqual(store.list(), []);
});
