import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { BookmarkError, BookmarkService, canonicalizeUrl, normalizeLabels, validateUrl } from '../lib/bookmarks.js';
import { JsonStore } from '../lib/store.js';

async function fixture(metadataFetcher = async () => ({ title: 'Fetched title', description: 'Fetched description', site: 'Example', icon: '' })) {
  const directory = await mkdtemp(join(tmpdir(), 'keep-test-'));
  const store = new JsonStore(join(directory, 'bookmarks.json'), []);
  await store.initialize();
  return { service: new BookmarkService(store, metadataFetcher), cleanup: () => rm(directory, { recursive: true, force: true }) };
}

test('SCN-011 accepts only complete HTTP or HTTPS addresses', () => {
  assert.equal(validateUrl('https://example.com/article').hostname, 'example.com');
  assert.throws(() => validateUrl('not a link'), (error) => error instanceof BookmarkError && error.code === 'INVALID_URL');
  assert.throws(() => validateUrl('file:///private/bookmarks'), (error) => error.code === 'INVALID_URL');
});

test('SCN-002 and SCN-012 canonical identity ignores fragments and known tracking noise', () => {
  assert.equal(
    canonicalizeUrl('https://Example.com/article/?utm_source=newsletter&fbclid=abc#comments'),
    'https://example.com/article'
  );
  assert.notEqual(canonicalizeUrl('https://example.com/article?page=1'), canonicalizeUrl('https://example.com/article?page=2'));
});

test('SCN-003 and SCN-014 normalize blank and duplicate labels', () => {
  assert.deepEqual(normalizeLabels(['design', ' DESIGN ', '', '  ', 'Typography']), ['design', 'Typography']);
});

test('SCN-001 saves fetched readable details and SCN-002 returns duplicates', async (context) => {
  const { service, cleanup } = await fixture();
  context.after(cleanup);
  const first = await service.add('https://example.com/article');
  assert.equal(first.duplicate, false);
  assert.equal(first.bookmark.title, 'Fetched title');
  assert.equal(first.bookmark.metadataStatus, 'complete');
  const duplicate = await service.add('https://example.com/article?utm_campaign=test#section');
  assert.equal(duplicate.duplicate, true);
  assert.equal((await service.state()).bookmarks.length, 1);
});

test('SCN-010 keeps a fallback bookmark when metadata fetching fails', async (context) => {
  const { service, cleanup } = await fixture(async () => { throw new Error('offline'); });
  context.after(cleanup);
  const result = await service.add('https://unreachable.example/article');
  assert.equal(result.bookmark.metadataStatus, 'failed');
  assert.equal(result.bookmark.title, 'unreachable.example');
  assert.equal(result.bookmark.url, 'https://unreachable.example/article');
});

test('SCN-001 and SCN-003 edit text and label associations without duplicate labels', async (context) => {
  const { service, cleanup } = await fixture();
  context.after(cleanup);
  const { bookmark } = await service.add('https://example.com/edit');
  const updated = await service.update(bookmark.id, { title: 'My title', description: 'My words', labels: ['design', ' DESIGN ', 'reading'] });
  assert.equal(updated.title, 'My title');
  assert.equal(updated.description, 'My words');
  assert.deepEqual(updated.labels, ['design', 'reading']);
});

test('SCN-007, SCN-008, and SCN-015 statuses persist and archiving clears Read Later', async (context) => {
  const { service, cleanup } = await fixture();
  context.after(cleanup);
  const { bookmark } = await service.add('https://example.com/status');
  await service.update(bookmark.id, { readLater: true });
  const archived = await service.update(bookmark.id, { archived: true });
  assert.equal(archived.archived, true);
  assert.equal(archived.readLater, false);
  const laterState = await service.state();
  assert.equal(laterState.bookmarks[0].archived, true);
  const restored = await service.update(bookmark.id, { archived: false });
  assert.equal(restored.archived, false);
});

test('SCN-009 permanently deletes a bookmark from storage', async (context) => {
  const { service, cleanup } = await fixture();
  context.after(cleanup);
  const { bookmark } = await service.add('https://example.com/delete');
  const deleted = await service.delete(bookmark.id);
  assert.equal(deleted.id, bookmark.id);
  assert.equal((await service.state()).bookmarks.length, 0);
});
