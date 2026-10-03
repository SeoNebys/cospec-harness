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

test('DELETE /api/bookmarks/:id removes the bookmark (204) — FR-009', async () => {
  const created = await req(ctx.base, '/api/bookmarks', {
    method: 'POST',
    body: JSON.stringify({ url: 'example.com/del', title: 'Doomed' }),
  });
  const id = created.body.id;

  const del = await req(ctx.base, `/api/bookmarks/${id}`, { method: 'DELETE' });
  assert.equal(del.status, 204);

  const after = await req(ctx.base, `/api/bookmarks/${id}`);
  assert.equal(after.status, 404);
});

test('DELETE returns 404 for a missing id', async () => {
  const { status } = await req(ctx.base, '/api/bookmarks/99999', { method: 'DELETE' });
  assert.equal(status, 404);
});
