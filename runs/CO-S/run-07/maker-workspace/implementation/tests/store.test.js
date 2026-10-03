const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { BookmarkStore, StoreError, normaliseUrl } = require('../src/store');

function temporaryStore(nowValues = []) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'pocketmark-store-'));
  let index = 0;
  const store = new BookmarkStore(path.join(directory, 'bookmarks.json'), {
    now: () => nowValues[index++] || new Date(Date.UTC(2026, 8, 18, 10, 0, index)).toISOString(),
  });
  return { store, directory, file: path.join(directory, 'bookmarks.json') };
}

test('normalises one or more trailing slashes without merging different pages', () => {
  assert.equal(normaliseUrl('https://example.com/page/'), 'https://example.com/page');
  assert.equal(normaliseUrl('https://example.com/page///'), 'https://example.com/page');
  assert.notEqual(normaliseUrl('https://example.com/page-one'), normaliseUrl('https://example.com/page-two'));
});

test('creates, persists, and reloads bookmarks in newest-first order', (t) => {
  const times = ['2026-09-17T10:00:00.000Z', '2026-09-18T10:00:00.000Z'];
  const { store, directory, file } = temporaryStore(times);
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  store.create({ url: 'https://older.example', title: 'Older', tags: [] });
  const newer = store.create({ url: 'https://newer.example', title: 'Newer', description: 'Latest', tags: ['Reading'], isReadLater: true });
  assert.deepEqual(store.list().map((item) => item.title), ['Newer', 'Older']);
  const reloaded = new BookmarkStore(file);
  assert.equal(reloaded.find(newer.id).description, 'Latest');
  assert.equal(reloaded.find(newer.id).isReadLater, true);
});

test('prevents duplicate addresses that differ only by trailing slash', (t) => {
  const { store, directory } = temporaryStore();
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const existing = store.create({ url: 'https://example.com/page', title: 'Existing' });
  assert.throws(
    () => store.create({ url: 'https://example.com/page/', title: 'Copy' }),
    (error) => error instanceof StoreError && error.code === 'DUPLICATE' && error.existing.id === existing.id,
  );
  assert.equal(store.list().length, 1);
});

test('keeps genuinely different page addresses as separate bookmarks', (t) => {
  const { store, directory } = temporaryStore();
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  store.create({ url: 'https://example.com/page-one', title: 'Page one' });
  store.create({ url: 'https://example.com/page-two', title: 'Page two' });
  assert.equal(store.list().length, 2);
});

test('editing preserves original created time and canonical tag spelling', (t) => {
  const { store, directory } = temporaryStore(['2026-09-17T10:00:00.000Z', '2026-09-18T10:00:00.000Z', '2026-09-19T10:00:00.000Z']);
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const health = store.create({ url: 'https://health.example', title: 'Health', tags: ['Health'] });
  const newer = store.create({ url: 'https://newer.example', title: 'Newer', tags: [] });
  const updated = store.update(health.id, { url: 'https://health.example/corrected', title: 'Updated', description: 'Corrected', tags: ['health', 'Walking'] });
  assert.equal(updated.createdAt, '2026-09-17T10:00:00.000Z');
  assert.deepEqual(updated.tags, ['Health', 'Walking']);
  assert.deepEqual(store.list().map((item) => item.id), [newer.id, health.id]);
});

test('invalid edit and read-later changes do not corrupt a saved bookmark', (t) => {
  const { store, directory, file } = temporaryStore();
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const bookmark = store.create({ url: 'https://example.com', title: 'Good title', tags: [] });
  assert.throws(() => store.update(bookmark.id, { url: 'broken', title: '' }), (error) => error.code === 'INVALID_TITLE');
  assert.equal(store.find(bookmark.id).title, 'Good title');
  store.setReadLater(bookmark.id, true);
  assert.equal(new BookmarkStore(file).find(bookmark.id).isReadLater, true);
  store.setReadLater(bookmark.id, false);
  assert.equal(store.find(bookmark.id).isReadLater, false);
});

test('removing one bookmark leaves other bookmarks and shared tags intact', (t) => {
  const { store, directory } = temporaryStore();
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const first = store.create({ url: 'https://one.example', title: 'One', tags: ['Shared'] });
  const second = store.create({ url: 'https://two.example', title: 'Two', tags: ['Shared'] });
  store.remove(first.id);
  assert.equal(store.find(first.id), null);
  assert.deepEqual(store.find(second.id).tags, ['Shared']);
});
