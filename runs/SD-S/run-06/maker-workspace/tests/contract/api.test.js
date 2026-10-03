import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

process.env.NODE_ENV = 'test';
process.env.BOOKMARKS_DB = ':memory:';

const { default: app } = await import('../../src/server.js');

let server;
let base;

before(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', resolve);
  });
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => server && server.close());

const post = (path, body) =>
  fetch(base + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
const put = (path, body) =>
  fetch(base + path, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

test('GET /api/bookmarks returns empty list initially (FR-008)', async () => {
  const res = await fetch(base + '/api/bookmarks');
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.deepEqual(body.bookmarks, []);
});

test('POST /api/bookmarks creates a bookmark (201)', async () => {
  const res = await post('/api/bookmarks', { address: 'https://example.com/a', tags: ['news'] });
  assert.equal(res.status, 201);
  const { bookmark } = await res.json();
  assert.equal(bookmark.address, 'https://example.com/a');
  assert.ok(bookmark.title); // address-derived fallback present
  assert.deepEqual(bookmark.tags, ['news']);
});

test('POST /api/bookmarks rejects invalid address (400, FR-002)', async () => {
  const res = await post('/api/bookmarks', { address: 'not a url' });
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.ok(body.error);
});

test('POST duplicate address returns existing (200, FR-014/FR-015)', async () => {
  await post('/api/bookmarks', { address: 'https://dupe.com/x' });
  const res = await post('/api/bookmarks', { address: 'https://DUPE.com/x/' });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.existing, true);
  assert.equal(body.bookmark.address, 'https://dupe.com/x');
});

test('GET /api/tags lists tags in use (FR-009/FR-010)', async () => {
  const res = await fetch(base + '/api/tags');
  const body = await res.json();
  assert.ok(body.tags.includes('news'));
});

test('search is case-insensitive across fields (FR-011)', async () => {
  await post('/api/bookmarks', { address: 'https://searchme.com/xyz', tags: ['Reading'] });
  const res = await fetch(base + '/api/bookmarks?search=SEARCHME');
  const body = await res.json();
  assert.ok(body.bookmarks.some((b) => b.address.includes('searchme')));
  const byTag = await fetch(base + '/api/bookmarks?search=reading');
  const tagBody = await byTag.json();
  assert.ok(tagBody.bookmarks.length >= 1);
});

test('tag filter narrows the list (FR-010)', async () => {
  const res = await fetch(base + '/api/bookmarks?tag=news');
  const body = await res.json();
  assert.ok(body.bookmarks.every((b) => b.tags.map((t) => t.toLowerCase()).includes('news')));
});

test('PUT updates address/title/description (200, FR-012)', async () => {
  const created = await (await post('/api/bookmarks', { address: 'https://edit.com/1' })).json();
  const id = created.bookmark.id;
  const res = await put(`/api/bookmarks/${id}`, {
    address: 'https://edit.com/2',
    title: 'Edited',
    description: 'Desc',
    tags: ['x'],
  });
  assert.equal(res.status, 200);
  const { bookmark } = await res.json();
  assert.equal(bookmark.address, 'https://edit.com/2');
  assert.equal(bookmark.title, 'Edited');
  assert.equal(bookmark.description, 'Desc');
});

test('PUT rejects invalid address (400) and conflicting address (409)', async () => {
  const a = await (await post('/api/bookmarks', { address: 'https://conflict.com/a' })).json();
  const b = await (await post('/api/bookmarks', { address: 'https://conflict.com/b' })).json();
  const bad = await put(`/api/bookmarks/${b.bookmark.id}`, { address: 'nope' });
  assert.equal(bad.status, 400);
  const conflict = await put(`/api/bookmarks/${b.bookmark.id}`, { address: 'https://conflict.com/a' });
  assert.equal(conflict.status, 409);
  const cbody = await conflict.json();
  assert.equal(cbody.existingId, a.bookmark.id);
});

test('DELETE removes a bookmark (204/404, FR-013)', async () => {
  const created = await (await post('/api/bookmarks', { address: 'https://del.com/1' })).json();
  const id = created.bookmark.id;
  const del = await fetch(base + `/api/bookmarks/${id}`, { method: 'DELETE' });
  assert.equal(del.status, 204);
  const again = await fetch(base + `/api/bookmarks/${id}`, { method: 'DELETE' });
  assert.equal(again.status, 404);
});

test('GET /api/bookmarks/:id returns 404 for missing', async () => {
  const res = await fetch(base + '/api/bookmarks/999999');
  assert.equal(res.status, 404);
});
