import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer, jsonRequest } from './helper.js';

let server;
let id;

before(async () => {
  server = await startTestServer();
  const { body } = await jsonRequest(server.base, '/api/bookmarks', {
    method: 'POST',
    body: JSON.stringify({ url: 'https://edit.example.com', title: 'Original' }),
  });
  id = body.id;
});
after(async () => {
  await server.close();
});

test('PATCH /api/bookmarks/:id updates the title', async () => {
  const { status, body } = await jsonRequest(server.base, `/api/bookmarks/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ title: 'Updated title' }),
  });
  assert.equal(status, 200);
  assert.equal(body.title, 'Updated title');
});

test('PATCH /api/bookmarks/:id returns 404 for unknown id', async () => {
  const { status } = await jsonRequest(server.base, '/api/bookmarks/999999', {
    method: 'PATCH',
    body: JSON.stringify({ title: 'x' }),
  });
  assert.equal(status, 404);
});

test('DELETE /api/bookmarks/:id removes the bookmark (204)', async () => {
  const { status } = await jsonRequest(server.base, `/api/bookmarks/${id}`, {
    method: 'DELETE',
  });
  assert.equal(status, 204);
  const list = await jsonRequest(server.base, '/api/bookmarks');
  assert.equal(list.body.bookmarks.length, 0);
});

test('DELETE /api/bookmarks/:id returns 404 for unknown id', async () => {
  const { status } = await jsonRequest(server.base, '/api/bookmarks/999999', {
    method: 'DELETE',
  });
  assert.equal(status, 404);
});
