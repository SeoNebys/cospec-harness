import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer, req } from '../helper.js';

let srv;
before(async () => { srv = await startTestServer(); });
after(async () => { await srv.close(); });

test('POST valid address returns 201 with defaults', async () => {
  const { status, body } = await req(srv.base, '/bookmarks', {
    method: 'POST',
    body: JSON.stringify({ address: 'example.com', title: 'Example', tags: ['tech'] }),
  });
  assert.equal(status, 201);
  assert.equal(body.address, 'https://example.com/');
  assert.equal(body.title, 'Example');
  assert.equal(body.isRead, false);
  assert.equal(body.isArchived, false);
  assert.deepEqual(body.tags, ['tech']);
});

test('POST without address returns 400', async () => {
  const { status } = await req(srv.base, '/bookmarks', {
    method: 'POST',
    body: JSON.stringify({ title: 'no url' }),
  });
  assert.equal(status, 400);
});

test('POST duplicate address returns 409 with existingId', async () => {
  const first = await req(srv.base, '/bookmarks', {
    method: 'POST',
    body: JSON.stringify({ address: 'https://dup.example.com/', title: 'One' }),
  });
  assert.equal(first.status, 201);

  const dup = await req(srv.base, '/bookmarks', {
    method: 'POST',
    body: JSON.stringify({ address: 'dup.example.com', title: 'Two' }),
  });
  assert.equal(dup.status, 409);
  assert.equal(dup.body.existingId, first.body.id);
  assert.equal(dup.body.existingArchived, false);
});

test('missing title is derived, never empty', async () => {
  const { body } = await req(srv.base, '/bookmarks', {
    method: 'POST',
    body: JSON.stringify({ address: 'https://notitle.example.org/page' }),
  });
  assert.ok(body.title && body.title.length > 0);
});
