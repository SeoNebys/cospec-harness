import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, resetDb, api, postBookmark } from './helpers.js';

let ctx;

before(async () => {
  ctx = await startServer();
});

after(async () => {
  await ctx.close();
});

beforeEach(() => {
  resetDb();
});

test('lists bookmarks newest-first (FR-005)', async () => {
  await postBookmark(ctx.base, { url: 'https://one.example.com', title: 'One' });
  await postBookmark(ctx.base, { url: 'https://two.example.com', title: 'Two' });
  const { status, body } = await api(ctx.base, '/api/bookmarks');
  assert.equal(status, 200);
  assert.equal(body.total, 2);
  assert.equal(body.bookmarks[0].title, 'Two');
  assert.equal(body.bookmarks[1].title, 'One');
});

test('returns an empty list for an empty collection (FR-012)', async () => {
  const { status, body } = await api(ctx.base, '/api/bookmarks');
  assert.equal(status, 200);
  assert.equal(body.total, 0);
  assert.deepEqual(body.bookmarks, []);
});

test('updates a bookmark and refreshes updated_at (FR-007)', async () => {
  const created = await postBookmark(ctx.base, {
    url: 'https://edit.example.com',
    title: 'Before',
  });
  const id = created.body.bookmark.id;
  const originalUpdated = created.body.bookmark.updated_at;
  await new Promise((r) => setTimeout(r, 5));

  const { status, body } = await api(ctx.base, `/api/bookmarks/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'After', tags: ['x'] }),
  });
  assert.equal(status, 200);
  assert.equal(body.bookmark.title, 'After');
  assert.deepEqual(body.bookmark.tags, ['x']);
  assert.notEqual(body.bookmark.updated_at, originalUpdated);
});

test('rejects an update with an invalid url (FR-002)', async () => {
  const created = await postBookmark(ctx.base, {
    url: 'https://editbad.example.com',
  });
  const id = created.body.bookmark.id;
  const { status, body } = await api(ctx.base, `/api/bookmarks/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: 'nonsense scheme' }),
  });
  assert.equal(status, 400);
  assert.equal(body.error, 'invalid_url');
});

test('returns 404 when updating a missing bookmark', async () => {
  const { status, body } = await api(ctx.base, '/api/bookmarks/99999', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'x' }),
  });
  assert.equal(status, 404);
  assert.equal(body.error, 'not_found');
});

test('deletes a bookmark, then 404 on repeat (FR-008)', async () => {
  const created = await postBookmark(ctx.base, {
    url: 'https://del.example.com',
  });
  const id = created.body.bookmark.id;

  const first = await api(ctx.base, `/api/bookmarks/${id}`, { method: 'DELETE' });
  assert.equal(first.status, 204);

  const second = await api(ctx.base, `/api/bookmarks/${id}`, {
    method: 'DELETE',
  });
  assert.equal(second.status, 404);
  assert.equal(second.body.error, 'not_found');
});
