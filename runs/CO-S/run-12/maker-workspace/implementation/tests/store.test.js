import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { BookmarkStore } from '../lib/store.js';

test('persists, deduplicates, tags, archives, and restores bookmarks', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'keepwell-store-'));
  const file = join(directory, 'bookmarks.json'); const store = new BookmarkStore(file); await store.load();
  const first = await store.create({ url: 'https://EXAMPLE.com/page/#intro', title: 'Saved page', tags: [' Reading ', 'reading'], notes: 'My note' });
  assert.equal(first.duplicate, false); assert.deepEqual(first.bookmark.tags, ['reading']);
  const duplicate = await store.create({ url: 'https://example.com/page', title: 'Duplicate' });
  assert.equal(duplicate.duplicate, true); assert.equal(store.list().length, 1);
  const archived = await store.update(first.bookmark.id, { archived: true, readLater: true });
  assert.equal(archived.archived, true); assert.equal(archived.readLater, true); assert.equal(archived.notes, 'My note');
  const restored = await store.update(first.bookmark.id, { archived: false }); assert.equal(restored.archived, false);
  const disk = JSON.parse(await readFile(file, 'utf8')); assert.equal(disk.bookmarks.length, 1); assert.equal(disk.bookmarks[0].title, 'Saved page');
});

test('requires a recognizable title', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'keepwell-title-')); const store = new BookmarkStore(join(directory, 'bookmarks.json')); await store.load();
  await assert.rejects(store.create({ url: 'https://example.com', title: '   ' }), /title is required/);
});
