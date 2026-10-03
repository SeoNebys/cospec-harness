import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { BookmarkStore } from '../lib/store.js';
import { BookmarkService } from '../lib/bookmarks.js';

async function withService(run, metadataOverrides = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'bookmark-library-'));
  const dataFile = join(directory, 'bookmarks.json');
  let revision = 0;
  const metadataClient = {
    async retrieve(url) {
      revision += 1;
      if (metadataOverrides.fail) throw metadataOverrides.fail;
      return {
        title: metadataOverrides.title ?? `Useful page ${revision}`,
        description: metadataOverrides.description ?? `A complete page description for ${url}`,
        source: new URL(url).hostname.replace(/^www\./, '')
      };
    }
  };
  const store = await BookmarkStore.open(dataFile);
  const service = new BookmarkService({ store, metadataClient, clock: () => new Date(`2026-01-0${Math.min(revision + 1, 9)}T00:00:00Z`) });
  try { return await run({ service, store, dataFile }); }
  finally { await rm(directory, { recursive: true, force: true }); }
}

test('SCN-001 saves enriched page details and starts as Read later', async () => {
  await withService(async ({ service }) => {
    assert.deepEqual(service.list(), []);
    const result = await service.save({ url: 'https://Example.com/guide', label: '' });
    assert.equal(result.kind, 'created');
    assert.equal(result.bookmark.title, 'Useful page 1');
    assert.match(result.bookmark.description, /complete page description/);
    assert.equal(result.bookmark.source, 'example.com');
    assert.equal(result.bookmark.read, false);
    assert.equal(result.bookmark.archived, false);
  });
});

test('SCN-002 detects an active duplicate and refreshes the same bookmark', async () => {
  await withService(async ({ service }) => {
    const created = await service.save({ url: 'https://example.com/guide', label: '' });
    const duplicate = await service.save({ url: 'https://EXAMPLE.com/guide#section', label: '' });
    assert.equal(duplicate.kind, 'duplicate');
    assert.equal(duplicate.location, 'library');
    assert.equal(service.list().length, 1);
    const refreshed = await service.refresh(created.bookmark.id);
    assert.equal(refreshed.id, created.bookmark.id);
    assert.equal(refreshed.title, 'Useful page 2');
    assert.equal(service.list().length, 1);
  });
});

test('SCN-004 and SCN-012 add several labels but reject case-only duplicates', async () => {
  await withService(async ({ service }) => {
    const { bookmark } = await service.save({ url: 'https://example.com/guide', label: 'learning' });
    const second = await service.addLabel(bookmark.id, 'reference');
    assert.equal(second.added, true);
    assert.deepEqual(second.bookmark.labels, ['learning', 'reference']);
    const duplicate = await service.addLabel(bookmark.id, 'Learning');
    assert.equal(duplicate.added, false);
    assert.deepEqual(duplicate.bookmark.labels, ['learning', 'reference']);
  });
});

test('SCN-007 and SCN-013 move reading status in both directions without changing details', async () => {
  await withService(async ({ service }) => {
    const { bookmark } = await service.save({ url: 'https://example.com/guide', label: 'learning' });
    const read = await service.setRead(bookmark.id, true);
    assert.equal(read.read, true);
    assert.deepEqual(read.labels, ['learning']);
    assert.equal(read.url, bookmark.url);
    const unread = await service.setRead(bookmark.id, false);
    assert.equal(unread.read, false);
    assert.deepEqual(unread.labels, ['learning']);
  });
});

test('SCN-008 and SCN-014 archive, detect the archived duplicate, and restore the same record', async () => {
  await withService(async ({ service }) => {
    const { bookmark } = await service.save({ url: 'https://example.com/guide', label: 'reference' });
    await service.setRead(bookmark.id, true);
    const archived = await service.archive(bookmark.id);
    assert.equal(archived.archived, true);
    assert.equal(archived.read, true);
    assert.deepEqual(archived.labels, ['reference']);
    const duplicate = await service.save({ url: 'https://example.com/guide', label: '' });
    assert.equal(duplicate.kind, 'duplicate');
    assert.equal(duplicate.location, 'archive');
    assert.equal(service.list().length, 1);
    const restored = await service.restoreAndRefresh(bookmark.id);
    assert.equal(restored.id, bookmark.id);
    assert.equal(restored.archived, false);
    assert.equal(restored.title, 'Useful page 2');
    assert.equal(service.list().length, 1);
  });
});

test('SCN-009 rejects malformed and unsupported addresses without changing storage', async () => {
  await withService(async ({ service }) => {
    await assert.rejects(() => service.save({ url: 'not-a-link', label: '' }), { code: 'INVALID_URL' });
    await assert.rejects(() => service.save({ url: 'file:///tmp/page', label: '' }), { code: 'INVALID_URL' });
    assert.equal(service.list().length, 0);
  });
});

test('SCN-010 metadata failure creates no bookmark', async () => {
  const failure = Object.assign(new Error('metadata unavailable'), { code: 'METADATA_UNAVAILABLE' });
  await withService(async ({ service }) => {
    await assert.rejects(() => service.save({ url: 'https://example.com/unavailable', label: 'research' }));
    assert.equal(service.list().length, 0);
  }, { fail: failure });
});

test('SCN-015 preserves complete long details and all labels in storage', async () => {
  const longTitle = 'An unusually long title '.repeat(20);
  const longDescription = 'A deeply detailed description including accessibility guidance. '.repeat(20);
  await withService(async ({ service }) => {
    const { bookmark } = await service.save({ url: 'https://example.com/long', label: 'research' });
    await service.addLabel(bookmark.id, 'design');
    await service.addLabel(bookmark.id, 'accessibility');
    const stored = service.list()[0];
    assert.equal(stored.title, longTitle);
    assert.equal(stored.description, longDescription);
    assert.deepEqual(stored.labels, ['research', 'design', 'accessibility']);
  }, { title: longTitle, description: longDescription });
});

test('bookmark data persists when the store is reopened', async () => {
  await withService(async ({ service, dataFile }) => {
    await service.save({ url: 'https://example.com/persistent', label: 'reference' });
    const reopened = await BookmarkStore.open(dataFile);
    assert.equal(reopened.list().length, 1);
    assert.deepEqual(reopened.list()[0].labels, ['reference']);
  });
});
