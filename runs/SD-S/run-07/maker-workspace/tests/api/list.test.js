import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer, jsonRequest } from './helper.js';

let server;
before(async () => {
  server = await startTestServer();
  // Seed three bookmarks in a known order.
  for (const b of [
    { url: 'https://alpha.example.com', title: 'Alpha docs' },
    { url: 'https://beta.example.com', title: 'Beta guide' },
    { url: 'https://gamma.example.com/cats', title: 'Gamma cats' },
  ]) {
    await jsonRequest(server.base, '/api/bookmarks', {
      method: 'POST',
      body: JSON.stringify(b),
    });
  }
});
after(async () => {
  await server.close();
});

test('GET /api/bookmarks returns bookmarks newest-first', async () => {
  const { status, body } = await jsonRequest(server.base, '/api/bookmarks');
  assert.equal(status, 200);
  assert.equal(body.bookmarks.length, 3);
  assert.equal(body.bookmarks[0].title, 'Gamma cats'); // most recent first
  assert.equal(body.bookmarks[2].title, 'Alpha docs');
});

test('GET /api/bookmarks?q= filters by title case-insensitively', async () => {
  const { body } = await jsonRequest(server.base, '/api/bookmarks?q=beta');
  assert.equal(body.bookmarks.length, 1);
  assert.equal(body.bookmarks[0].title, 'Beta guide');
});

test('GET /api/bookmarks?q= filters by url', async () => {
  const { body } = await jsonRequest(server.base, '/api/bookmarks?q=cats');
  assert.equal(body.bookmarks.length, 1);
  assert.equal(body.bookmarks[0].title, 'Gamma cats');
});

test('GET /api/bookmarks?q= with no match returns empty array', async () => {
  const { body } = await jsonRequest(server.base, '/api/bookmarks?q=zzzznope');
  assert.deepEqual(body.bookmarks, []);
});
