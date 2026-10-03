import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer, jsonRequest } from './helper.js';

let server;
before(async () => {
  server = await startTestServer();
});
after(async () => {
  await server.close();
});

test('POST /api/bookmarks creates a bookmark (201)', async () => {
  const { status, body } = await jsonRequest(server.base, '/api/bookmarks', {
    method: 'POST',
    body: JSON.stringify({ url: 'https://example.com/a', title: 'Example A' }),
  });
  assert.equal(status, 201);
  assert.equal(body.url, 'https://example.com/a');
  assert.equal(body.title, 'Example A');
  assert.ok(body.id);
  assert.ok(body.createdAt);
  assert.deepEqual(body.tags, []);
});

test('POST /api/bookmarks rejects empty url (400)', async () => {
  const { status, body } = await jsonRequest(server.base, '/api/bookmarks', {
    method: 'POST',
    body: JSON.stringify({ url: '' }),
  });
  assert.equal(status, 400);
  assert.equal(body.error, 'A valid web address is required.');
});

test('POST /api/bookmarks rejects malformed url (400)', async () => {
  const { status, body } = await jsonRequest(server.base, '/api/bookmarks', {
    method: 'POST',
    body: JSON.stringify({ url: 'not a url', title: 'x' }),
  });
  assert.equal(status, 400);
  assert.equal(body.error, 'A valid web address is required.');
});

test('POST /api/bookmarks warns on duplicate normalized url (409)', async () => {
  await jsonRequest(server.base, '/api/bookmarks', {
    method: 'POST',
    body: JSON.stringify({ url: 'https://dup.example.com/x', title: 'First' }),
  });
  const { status, body } = await jsonRequest(server.base, '/api/bookmarks', {
    method: 'POST',
    // trailing slash + uppercase host: same normalized url
    body: JSON.stringify({ url: 'https://DUP.example.com/x/', title: 'Second' }),
  });
  assert.equal(status, 409);
  assert.equal(body.error, 'This address is already bookmarked.');
  assert.ok(body.existingId);
});
