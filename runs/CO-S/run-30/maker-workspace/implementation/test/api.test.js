import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { BookmarkStore } from '../lib/store.js';
import { BookmarkService } from '../lib/bookmarks.js';
import { createRequestHandler } from '../server.js';

test('bookmark HTTP API exposes creation, duplicate, status, archive, and restore behavior', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'bookmark-api-'));
  const store = await BookmarkStore.open(join(directory, 'data.json'));
  const metadataClient = { retrieve: async (url) => ({ title: 'Example page', description: 'An example page description.', source: new URL(url).hostname }) };
  const service = new BookmarkService({ store, metadataClient });
  const server = createServer(createRequestHandler(service));
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const post = (path, body = {}) => fetch(`${origin}${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

  try {
    const createdResponse = await post('/api/bookmarks', { url: 'https://example.com/page', label: 'learning' });
    assert.equal(createdResponse.status, 201);
    const created = (await createdResponse.json()).bookmark;

    const duplicateResponse = await post('/api/bookmarks', { url: 'https://example.com/page', label: '' });
    assert.equal(duplicateResponse.status, 409);
    assert.equal((await duplicateResponse.json()).location, 'library');

    assert.equal((await post(`/api/bookmarks/${created.id}/read-status`, { read: true })).status, 200);
    assert.equal((await post(`/api/bookmarks/${created.id}/archive`)).status, 200);

    const archivedDuplicate = await post('/api/bookmarks', { url: 'https://example.com/page', label: '' });
    assert.equal((await archivedDuplicate.json()).location, 'archive');
    assert.equal((await post(`/api/bookmarks/${created.id}/restore`)).status, 200);

    const list = await fetch(`${origin}/api/bookmarks`).then((response) => response.json());
    assert.equal(list.bookmarks.length, 1);
    assert.equal(list.bookmarks[0].read, true);
    assert.equal(list.bookmarks[0].archived, false);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await rm(directory, { recursive: true, force: true });
  }
});
