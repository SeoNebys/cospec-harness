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

test('PUT /api/bookmarks/:id updates fields and updated_at — FR-008', async () => {
  const created = await req(ctx.base, '/api/bookmarks', {
    method: 'POST',
    body: JSON.stringify({ url: 'example.com/edit', title: 'Old', tags: ['a'] }),
  });
  const id = created.body.id;

  await new Promise((r) => setTimeout(r, 5)); // ensure timestamp can differ

  const updated = await req(ctx.base, `/api/bookmarks/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ title: 'New', notes: 'note', tags: ['b', 'c'] }),
  });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.title, 'New');
  assert.equal(updated.body.notes, 'note');
  assert.deepEqual(updated.body.tags, ['b', 'c']);
  assert.notEqual(updated.body.updated_at, updated.body.created_at);
});

test('PUT re-validates a supplied url (400 on invalid)', async () => {
  const created = await req(ctx.base, '/api/bookmarks', {
    method: 'POST',
    body: JSON.stringify({ url: 'example.com/edit2', title: 'T' }),
  });
  const { status, body } = await req(ctx.base, `/api/bookmarks/${created.body.id}`, {
    method: 'PUT',
    body: JSON.stringify({ url: 'nope' }),
  });
  assert.equal(status, 400);
  assert.equal(body.error, 'invalid_url');
});

test('PUT returns 404 for a missing id', async () => {
  const { status } = await req(ctx.base, '/api/bookmarks/99999', {
    method: 'PUT',
    body: JSON.stringify({ title: 'x' }),
  });
  assert.equal(status, 404);
});
