import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { BookmarkStore, canonicalizeAddress, normalizeTags, parseWebAddress } from '../store.mjs';
import { parsePageMetadata } from '../metadata.mjs';

async function withStore(run, options = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'tuck-test-'));
  const store = new BookmarkStore(join(directory, 'bookmarks.json'), options);
  try {
    await run(store);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

test('SCN-011 accepts only complete HTTP(S) addresses', () => {
  assert.equal(parseWebAddress('https://example.com').hostname, 'example.com');
  assert.throws(() => parseWebAddress('not a link'), /complete web address/);
  assert.throws(() => parseWebAddress('file:///tmp/link'), /complete web address/);
});

test('SCN-003 and SCN-016 normalize harmless address variations but preserve distinct content selectors', () => {
  assert.equal(canonicalizeAddress('https://EXAMPLE.com/'), canonicalizeAddress('https://example.com/#about'));
  assert.equal(canonicalizeAddress('https://example.com/story/'), canonicalizeAddress('https://example.com/story'));
  assert.notEqual(canonicalizeAddress('https://example.com/?article=1'), canonicalizeAddress('https://example.com/?article=2'));
});

test('SCN-009 and SCN-015 normalize tags and remove case-variant duplicates', () => {
  assert.deepEqual(normalizeTags(['Reading', 'work', 'READING', '  recipes  ', '']), ['reading', 'work', 'recipes']);
});

test('SCN-001, SCN-003, SCN-004 and SCN-008 persist, order, deduplicate, and tag bookmarks', async () => {
  await withStore(async (store) => {
    const first = await store.create({ url: 'https://example.com/', title: 'Example', tags: ['reading', 'work'] });
    assert.equal(first.created, true);
    const duplicate = await store.create({ url: 'https://example.com/#section', title: 'Ignored' });
    assert.equal(duplicate.created, false);
    assert.equal(duplicate.bookmark.id, first.bookmark.id);
    const second = await store.create({ url: 'https://example.com/?article=2', title: 'Second', tags: ['reading'] });
    assert.equal(second.created, true);

    const list = await store.list();
    assert.equal(list.length, 2);
    assert.equal(list[0].title, 'Second');
    assert.deepEqual(await store.tagSuggestions('READ'), [{ name: 'reading', uses: 2 }]);
  });
});

test('SCN-012 falls back to the site name with plain metadata', async () => {
  await withStore(async (store) => {
    const result = await store.create({ url: 'https://notes.example.net/field-guide', title: '', description: '', iconUrl: '' });
    assert.equal(result.bookmark.title, 'notes.example.net');
    assert.equal(result.bookmark.description, '');
    assert.equal(result.bookmark.iconUrl, '');
    assert.equal(result.bookmark.iconText, 'N');
  });
});

test('SCN-010 and SCN-017 remove and restore a bookmark within the Undo window', async () => {
  await withStore(async (store) => {
    const created = await store.create({ url: 'https://example.com', title: 'Example' });
    const removed = await store.remove(created.bookmark.id);
    assert.equal(removed.id, created.bookmark.id);
    assert.equal((await store.list()).length, 0);
    const restored = await store.restore(created.bookmark.id);
    assert.equal(restored.id, created.bookmark.id);
    assert.equal((await store.list()).length, 1);
  });
});

test('SCN-010 refuses restore after the Undo window ends', async () => {
  await withStore(async (store) => {
    const created = await store.create({ url: 'https://example.com', title: 'Example' });
    await store.remove(created.bookmark.id);
    await new Promise((resolve) => setTimeout(resolve, 35));
    assert.equal(await store.restore(created.bookmark.id), null);
  }, { undoWindowMs: 20 });
});

test('SCN-002 parses title, description, and relative site icon', () => {
  const metadata = parsePageMetadata(`<!doctype html><html><head>
    <title>Fallback</title>
    <meta property="og:title" content="A useful page">
    <meta name="description" content="A concise description &amp; note">
    <link rel="icon" href="/favicon.png">
  </head></html>`, 'https://example.com/articles/one');
  assert.deepEqual(metadata, {
    title: 'A useful page',
    description: 'A concise description & note',
    iconUrl: 'https://example.com/favicon.png',
    iconText: 'A'
  });
});

test('SCN-002 ignores non-web icon placeholders so the plain icon can be used', () => {
  const metadata = parsePageMetadata('<title>Example Domain</title><link rel="icon" href="data:,">', 'https://example.com/');
  assert.equal(metadata.iconUrl, '');
  assert.equal(metadata.iconText, 'E');
});
