import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, req } from './helper.js';

let ctx;
before(async () => {
  ctx = await startServer();
});
after(async () => {
  await ctx.stop();
});

test('GET /api/bookmarks returns empty with total 0 initially — FR-013', async () => {
  const { status, body } = await req(ctx.base, '/api/bookmarks');
  assert.equal(status, 200);
  assert.deepEqual(body.bookmarks, []);
  assert.equal(body.total, 0);
  assert.equal(body.matched, 0);
});

test('GET /api/bookmarks lists newest-first with counts — FR-006', async () => {
  await req(ctx.base, '/api/bookmarks', {
    method: 'POST',
    body: JSON.stringify({ url: 'example.com/first', title: 'First' }),
  });
  await req(ctx.base, '/api/bookmarks', {
    method: 'POST',
    body: JSON.stringify({ url: 'example.com/second', title: 'Second' }),
  });

  const { status, body } = await req(ctx.base, '/api/bookmarks');
  assert.equal(status, 200);
  assert.equal(body.total, 2);
  assert.equal(body.matched, 2);
  // Newest first: "Second" was created last.
  assert.equal(body.bookmarks[0].title, 'Second');
  assert.equal(body.bookmarks[1].title, 'First');
});

test('GET /api/bookmarks/:id returns 404 for a missing id', async () => {
  const { status, body } = await req(ctx.base, '/api/bookmarks/99999');
  assert.equal(status, 404);
  assert.equal(body.error, 'not_found');
});
