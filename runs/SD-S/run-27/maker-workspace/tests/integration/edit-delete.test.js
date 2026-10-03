import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

process.env.BOOKMARKS_DB_PATH = ':memory:';

let server;
let base;

before(async () => {
  const { createApp } = await import('../../src/server.js');
  server = createApp().listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => server.close());

async function json(path, options) {
  const res = await fetch(base + path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const data = res.status === 204 ? null : await res.json().catch(() => ({}));
  return { status: res.status, data };
}

test('PUT updates title, note, and tags', async () => {
  const created = await json('/api/bookmarks', {
    method: 'POST',
    body: JSON.stringify({ address: 'https://edit.com/', tags: ['old'] }),
  });
  const id = created.data.bookmark.id;

  const updated = await json(`/api/bookmarks/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ title: 'New', note: 'n', tags: ['fresh'] }),
  });
  assert.equal(updated.status, 200);
  assert.equal(updated.data.bookmark.title, 'New');
  assert.deepEqual(updated.data.bookmark.tags, ['fresh']);

  // Orphaned tag "old" should be pruned from the tags list.
  const tags = (await (await fetch(base + '/api/tags')).json()).tags;
  assert.ok(!tags.includes('old'));
});

test('PUT with invalid address returns 400', async () => {
  const created = await json('/api/bookmarks', {
    method: 'POST',
    body: JSON.stringify({ address: 'https://x.com/' }),
  });
  const id = created.data.bookmark.id;
  const r = await json(`/api/bookmarks/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ address: 'notaurl' }),
  });
  assert.equal(r.status, 400);
});

test('DELETE removes the bookmark', async () => {
  const created = await json('/api/bookmarks', {
    method: 'POST',
    body: JSON.stringify({ address: 'https://del.com/' }),
  });
  const id = created.data.bookmark.id;

  const del = await json(`/api/bookmarks/${id}`, { method: 'DELETE' });
  assert.equal(del.status, 204);

  const fetchAgain = await json(`/api/bookmarks/${id}`);
  assert.equal(fetchAgain.status, 404);
});

test('PUT and DELETE on missing id return 404', async () => {
  const put = await json('/api/bookmarks/99999', {
    method: 'PUT',
    body: JSON.stringify({ title: 'x' }),
  });
  assert.equal(put.status, 404);
  const del = await json('/api/bookmarks/99999', { method: 'DELETE' });
  assert.equal(del.status, 404);
});
