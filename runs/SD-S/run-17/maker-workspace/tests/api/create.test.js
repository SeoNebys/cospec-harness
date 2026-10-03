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

test('POST /api/bookmarks creates with a supplied title (201) — FR-001/014', async () => {
  const { status, body } = await req(ctx.base, '/api/bookmarks', {
    method: 'POST',
    body: JSON.stringify({ url: 'example.com/a', title: 'My Page', tags: ['x'] }),
  });
  assert.equal(status, 201);
  assert.equal(body.url, 'https://example.com/a'); // normalised (FR-003)
  assert.equal(body.title, 'My Page');
  assert.deepEqual(body.tags, ['x']);
  assert.ok(body.created_at, 'created_at is set');
  assert.equal(body.created_at, body.updated_at);
});

test('POST auto-fills title from the address when blank & unreachable (FR-004)', async () => {
  const { status, body } = await req(ctx.base, '/api/bookmarks', {
    method: 'POST',
    // TEST-NET-1 host will not answer, so title falls back to the address.
    body: JSON.stringify({ url: 'http://192.0.2.1/thing', title: '' }),
  });
  assert.equal(status, 201);
  assert.equal(body.title, 'http://192.0.2.1/thing');
});

test('POST rejects an invalid address (400) — FR-002', async () => {
  const { status, body } = await req(ctx.base, '/api/bookmarks', {
    method: 'POST',
    body: JSON.stringify({ url: 'not a url' }),
  });
  assert.equal(status, 400);
  assert.equal(body.error, 'invalid_url');
  assert.match(body.message, /valid web address/i);
});

test('POST rejects a missing address (400)', async () => {
  const { status, body } = await req(ctx.base, '/api/bookmarks', {
    method: 'POST',
    body: JSON.stringify({ title: 'no url' }),
  });
  assert.equal(status, 400);
  assert.equal(body.error, 'invalid_url');
});
