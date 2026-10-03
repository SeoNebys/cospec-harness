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

test('duplicate address is warned (409), then savable with confirm (201) — FR-010', async () => {
  const first = await req(ctx.base, '/api/bookmarks', {
    method: 'POST',
    body: JSON.stringify({ url: 'example.com/dup', title: 'One' }),
  });
  assert.equal(first.status, 201);

  // Same page, trailing slash + scheme difference → still detected as duplicate.
  const second = await req(ctx.base, '/api/bookmarks', {
    method: 'POST',
    body: JSON.stringify({ url: 'http://example.com/dup/', title: 'Two' }),
  });
  assert.equal(second.status, 409);
  assert.equal(second.body.error, 'already_saved');
  assert.equal(second.body.existingId, first.body.id);

  // Re-submit with confirmDuplicate → allowed.
  const third = await req(ctx.base, '/api/bookmarks', {
    method: 'POST',
    body: JSON.stringify({ url: 'http://example.com/dup/', title: 'Two', confirmDuplicate: true }),
  });
  assert.equal(third.status, 201);
  assert.notEqual(third.body.id, first.body.id);
});
