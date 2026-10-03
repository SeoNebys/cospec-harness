import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { BookmarkStore, filterBookmarks, normalizeAddress } from '../lib/store.mjs';

async function fixture(t) {
  const directory = await mkdtemp(join(tmpdir(), 'keepwell-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return new BookmarkStore(join(directory, 'bookmarks.json'));
}

test('SCN-001 saves an enriched bookmark with stable fields', async (t) => {
  const store = await fixture(t);
  const { bookmark, duplicate } = await store.create({ url: 'https://example.com/article', title: 'Useful article', description: 'A useful summary', siteName: 'Example', iconUrl: 'https://example.com/icon.png', imageUrl: 'https://example.com/image.png' });
  assert.equal(duplicate, false);
  assert.equal(bookmark.title, 'Useful article');
  assert.equal(bookmark.readLater, false);
  assert.equal((await store.all()).length, 1);
});

test('SCN-003 returns the existing bookmark for the exact same normalized address', async (t) => {
  const store = await fixture(t);
  const first = await store.create({ url: 'HTTPS://EXAMPLE.COM:443/article', title: 'First' });
  const second = await store.create({ url: 'https://example.com/article', title: 'Second' });
  assert.equal(second.duplicate, true);
  assert.equal(second.bookmark.id, first.bookmark.id);
  assert.equal((await store.all()).length, 1);
});

test('SCN-022 rejects incomplete and unsupported addresses', () => {
  assert.throws(() => normalizeAddress('example'), /INVALID_URL/);
  assert.throws(() => normalizeAddress('file:///etc/passwd'), /INVALID_URL/);
});

test('SCN-002, SCN-010, SCN-011 and SCN-014 update bookmark details and states', async (t) => {
  const store = await fixture(t);
  const { bookmark } = await store.create({ url: 'https://example.com/a', title: 'Original' });
  const updated = await store.update(bookmark.id, { title: 'Edited', description: 'Edited description', note: 'Remember this', readLater: true, archived: true });
  assert.equal(updated.title, 'Edited');
  assert.equal(updated.note, 'Remember this');
  assert.equal(updated.readLater, true);
  assert.equal(updated.archived, true);
});

test('SCN-004 and SCN-005 attach unique existing or new tags', async (t) => {
  const store = await fixture(t);
  const { bookmark } = await store.create({ url: 'https://example.com/a', title: 'Tagged' });
  await store.update(bookmark.id, { tags: ['Design', 'Design', 'Reading'] });
  assert.deepEqual((await store.all())[0].tags, ['Design', 'Reading']);
  assert.deepEqual(await store.tags(), ['Design', 'Reading']);
});

test('SCN-006 through SCN-009 filter full text, tags, views and sort current results', () => {
  const items = [
    { id: '1', title: 'Zebra', description: 'calm summary', note: 'workshop reference', url: 'https://one.example/a', tags: ['Design'], archived: false, readLater: true, createdAt: '2026-01-02' },
    { id: '2', title: 'Alpha', description: 'other', note: '', url: 'https://workbench.example/a', tags: ['Research'], archived: false, readLater: false, createdAt: '2026-01-01' },
    { id: '3', title: 'Archived', description: '', note: '', url: 'https://three.example/a', tags: ['Design'], archived: true, readLater: false, createdAt: '2026-01-03' }
  ];
  assert.deepEqual(filterBookmarks(items, { query: 'workshop' }).map((item) => item.id), ['1']);
  assert.deepEqual(filterBookmarks(items, { query: 'workbench.example' }).map((item) => item.id), ['2']);
  assert.deepEqual(filterBookmarks(items, { tag: 'Design' }).map((item) => item.id), ['1']);
  assert.deepEqual(filterBookmarks(items, { view: 'readLater' }).map((item) => item.id), ['1']);
  assert.deepEqual(filterBookmarks(items, { view: 'archive' }).map((item) => item.id), ['3']);
  assert.deepEqual(filterBookmarks(items, { sort: 'title' }).map((item) => item.id), ['2', '1']);
  assert.deepEqual(filterBookmarks(items, { query: 'missing' }), []);
});

test('SCN-018 through SCN-020 apply bulk tag, archive and delete', async (t) => {
  const store = await fixture(t);
  const a = (await store.create({ url: 'https://example.com/a', title: 'A' })).bookmark;
  const b = (await store.create({ url: 'https://example.com/b', title: 'B' })).bookmark;
  await store.bulk([a.id, b.id], 'tag', 'Reading');
  assert.ok((await store.all()).every((item) => item.tags.includes('Reading')));
  await store.bulk([a.id, b.id], 'archive');
  assert.ok((await store.all()).every((item) => item.archived));
  const result = await store.bulk([a.id, b.id], 'delete');
  assert.equal(result.count, 2);
  assert.equal((await store.all()).length, 0);
});

test('data persists when a store is reopened', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'keepwell-persist-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const file = join(directory, 'bookmarks.json');
  const first = new BookmarkStore(file);
  await first.create({ url: 'https://example.com/persist', title: 'Persistent' });
  const reopened = new BookmarkStore(file);
  assert.equal((await reopened.all())[0].title, 'Persistent');
});
