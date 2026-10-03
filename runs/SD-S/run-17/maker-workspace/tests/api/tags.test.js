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

test('GET /api/tags returns existing tag names (FR-012)', async () => {
  await req(ctx.base, '/api/bookmarks', {
    method: 'POST',
    body: JSON.stringify({ url: 'example.com/t1', title: 'T1', tags: ['reading', 'tech'] }),
  });
  await req(ctx.base, '/api/bookmarks', {
    method: 'POST',
    body: JSON.stringify({ url: 'example.com/t2', title: 'T2', tags: ['tech'] }),
  });

  const { status, body } = await req(ctx.base, '/api/tags');
  assert.equal(status, 200);
  assert.deepEqual([...body.tags].sort(), ['reading', 'tech']);
});

test('orphan tags are pruned after their last bookmark is deleted', async () => {
  const created = await req(ctx.base, '/api/bookmarks', {
    method: 'POST',
    body: JSON.stringify({ url: 'example.com/only', title: 'Only', tags: ['solo'] }),
  });
  await req(ctx.base, `/api/bookmarks/${created.body.id}`, { method: 'DELETE' });

  const { body } = await req(ctx.base, '/api/tags');
  assert.ok(!body.tags.includes('solo'));
});
