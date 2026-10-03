import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

process.env.BOOKMARKS_DB_PATH = ':memory:';

let server;
let base;

before(async () => {
  const { createApp } = await import('../../src/server.js');
  server = createApp().listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => server.close());

async function post(path, body) {
  const res = await fetch(base + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

test('POST with address only returns 201', async () => {
  const { status, data } = await post('/api/bookmarks', {
    address: 'example.com',
  });
  assert.equal(status, 201);
  assert.equal(data.bookmark.address, 'https://example.com/');
  assert.equal(data.duplicateOf, null);
});

test('POST with no address returns 400 with error', async () => {
  const { status, data } = await post('/api/bookmarks', { title: 'x' });
  assert.equal(status, 400);
  assert.ok(data.error);
});

test('duplicate address is saved with duplicateOf hint', async () => {
  const first = await post('/api/bookmarks', { address: 'https://dup.com/' });
  const second = await post('/api/bookmarks', { address: 'https://dup.com/' });
  assert.equal(second.status, 201);
  assert.equal(second.data.duplicateOf, first.data.bookmark.id);
});
