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

beforeEach(async () => {
  resetDb();
  await postBookmark(ctx.base, {
    url: 'https://news.example.com/space',
    title: 'Space News',
    tags: ['science', 'reading'],
  });
  await postBookmark(ctx.base, {
    url: 'https://cooking.example.com/pasta',
    title: 'Pasta Recipes',
    tags: ['cooking'],
  });
});

test('searches case-insensitively over title and url (FR-011)', async () => {
  const byTitle = await api(ctx.base, '/api/bookmarks?q=pasta');
  assert.equal(byTitle.body.total, 1);
  assert.equal(byTitle.body.bookmarks[0].title, 'Pasta Recipes');

  const byUrl = await api(ctx.base, '/api/bookmarks?q=NEWS');
  assert.equal(byUrl.body.total, 1);
  assert.equal(byUrl.body.bookmarks[0].title, 'Space News');
});

test('filters by an exact tag (FR-010)', async () => {
  const { body } = await api(ctx.base, '/api/bookmarks?tag=cooking');
  assert.equal(body.total, 1);
  assert.equal(body.bookmarks[0].title, 'Pasta Recipes');
});

test('combines search and tag with AND', async () => {
  const both = await api(ctx.base, '/api/bookmarks?q=space&tag=cooking');
  assert.equal(both.body.total, 0);

  const match = await api(ctx.base, '/api/bookmarks?q=space&tag=science');
  assert.equal(match.body.total, 1);
  assert.equal(match.body.bookmarks[0].title, 'Space News');
});

test('returns empty for a non-matching search (FR-012)', async () => {
  const { body } = await api(ctx.base, '/api/bookmarks?q=zzzznope');
  assert.equal(body.total, 0);
  assert.deepEqual(body.bookmarks, []);
});

test('lists distinct sorted tags (GET /api/tags)', async () => {
  const { status, body } = await api(ctx.base, '/api/tags');
  assert.equal(status, 200);
  assert.deepEqual(body.tags, ['cooking', 'reading', 'science']);
});
