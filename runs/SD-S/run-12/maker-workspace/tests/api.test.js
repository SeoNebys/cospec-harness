import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../server/db.js';
import { createStore } from '../server/bookmarks.js';
import { createApp } from '../server/index.js';

// Spin up an isolated in-memory app for each test group.
function makeServer() {
  const db = openDb(':memory:');
  const app = createApp(createStore(db));
  return new Promise((resolve) => {
    const server = app.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({
        base: `http://127.0.0.1:${port}`,
        close: () => new Promise((r) => server.close(r)),
      });
    });
  });
}

async function req(base, path, options) {
  const res = await fetch(`${base}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const body = res.status === 204 ? null : await res.json();
  return { status: res.status, body };
}

test('POST creates a bookmark, normalizing url and deriving label (FR-001/003/004)', async () => {
  const s = await makeServer();
  const { status, body } = await req(s.base, '/api/bookmarks', {
    method: 'POST',
    body: JSON.stringify({ url: 'example.com', tags: ['reading'] }),
  });
  assert.equal(status, 201);
  assert.equal(body.bookmark.url, 'https://example.com/');
  assert.equal(body.bookmark.displayLabel, 'example.com'); // no title → fallback
  assert.deepEqual(body.bookmark.tags, ['reading']);
  assert.equal(body.warning, undefined);
  await s.close();
});

test('POST uses title as display label when provided (FR-004)', async () => {
  const s = await makeServer();
  const { body } = await req(s.base, '/api/bookmarks', {
    method: 'POST',
    body: JSON.stringify({ url: 'example.com', title: 'Example' }),
  });
  assert.equal(body.bookmark.displayLabel, 'Example');
  await s.close();
});

test('POST rejects an invalid url with 400 (FR-002)', async () => {
  const s = await makeServer();
  const { status, body } = await req(s.base, '/api/bookmarks', {
    method: 'POST',
    body: JSON.stringify({ url: 'not a url' }),
  });
  assert.equal(status, 400);
  assert.equal(body.error, 'Invalid URL');
  await s.close();
});

test('POST warns but still creates on duplicate url (FR-013)', async () => {
  const s = await makeServer();
  await req(s.base, '/api/bookmarks', {
    method: 'POST',
    body: JSON.stringify({ url: 'https://dup.com' }),
  });
  const second = await req(s.base, '/api/bookmarks', {
    method: 'POST',
    body: JSON.stringify({ url: 'https://dup.com' }),
  });
  assert.equal(second.status, 201);
  assert.equal(second.body.warning, 'duplicate_url');

  const list = await req(s.base, '/api/bookmarks');
  assert.equal(list.body.bookmarks.length, 2); // deliberate duplicate kept
  await s.close();
});

test('GET lists bookmarks most-recently-added first (FR-005/014)', async () => {
  const s = await makeServer();
  await req(s.base, '/api/bookmarks', { method: 'POST', body: JSON.stringify({ url: 'a.com', title: 'First' }) });
  await req(s.base, '/api/bookmarks', { method: 'POST', body: JSON.stringify({ url: 'b.com', title: 'Second' }) });
  const { body } = await req(s.base, '/api/bookmarks');
  assert.deepEqual(body.bookmarks.map((b) => b.title), ['Second', 'First']);
  await s.close();
});

test('GET returns empty array when none exist (FR-012)', async () => {
  const s = await makeServer();
  const { body } = await req(s.base, '/api/bookmarks');
  assert.deepEqual(body.bookmarks, []);
  await s.close();
});

test('PUT updates fields and refreshes dateUpdated (FR-007)', async () => {
  const s = await makeServer();
  const created = await req(s.base, '/api/bookmarks', {
    method: 'POST',
    body: JSON.stringify({ url: 'example.com', title: 'Old' }),
  });
  const id = created.body.bookmark.id;
  const updated = await req(s.base, `/api/bookmarks/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ url: 'example.org', title: 'New', tags: ['x'] }),
  });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.bookmark.title, 'New');
  assert.equal(updated.body.bookmark.url, 'https://example.org/');
  assert.deepEqual(updated.body.bookmark.tags, ['x']);
  assert.ok(updated.body.bookmark.dateUpdated >= created.body.bookmark.dateUpdated);
  await s.close();
});

test('PUT invalid url → 400, missing id → 404 (FR-007)', async () => {
  const s = await makeServer();
  const created = await req(s.base, '/api/bookmarks', {
    method: 'POST',
    body: JSON.stringify({ url: 'example.com' }),
  });
  const bad = await req(s.base, `/api/bookmarks/${created.body.bookmark.id}`, {
    method: 'PUT',
    body: JSON.stringify({ url: 'nope nope' }),
  });
  assert.equal(bad.status, 400);
  const missing = await req(s.base, '/api/bookmarks/99999', {
    method: 'PUT',
    body: JSON.stringify({ url: 'example.com' }),
  });
  assert.equal(missing.status, 404);
  await s.close();
});

test('DELETE removes a bookmark and cascades tags (FR-008)', async () => {
  const s = await makeServer();
  const created = await req(s.base, '/api/bookmarks', {
    method: 'POST',
    body: JSON.stringify({ url: 'example.com', tags: ['gone'] }),
  });
  const id = created.body.bookmark.id;
  const del = await req(s.base, `/api/bookmarks/${id}`, { method: 'DELETE' });
  assert.equal(del.status, 204);

  const list = await req(s.base, '/api/bookmarks');
  assert.equal(list.body.bookmarks.length, 0);
  const tags = await req(s.base, '/api/tags');
  assert.deepEqual(tags.body.tags, []); // tag link removed with the bookmark

  const missing = await req(s.base, `/api/bookmarks/${id}`, { method: 'DELETE' });
  assert.equal(missing.status, 404);
  await s.close();
});

test('GET ?q= searches title/url/notes/tags case-insensitively (FR-011)', async () => {
  const s = await makeServer();
  await req(s.base, '/api/bookmarks', { method: 'POST', body: JSON.stringify({ url: 'https://news.example.com', title: 'Daily News' }) });
  await req(s.base, '/api/bookmarks', { method: 'POST', body: JSON.stringify({ url: 'https://docs.example.com', title: 'Docs', tags: ['reference'] }) });
  await req(s.base, '/api/bookmarks', { method: 'POST', body: JSON.stringify({ url: 'https://blog.example.com', title: 'Blog', notes: 'weekend reading' }) });

  const byTitle = await req(s.base, '/api/bookmarks?q=daily');
  assert.deepEqual(byTitle.body.bookmarks.map((b) => b.title), ['Daily News']);

  const byTag = await req(s.base, '/api/bookmarks?q=REFERENCE');
  assert.deepEqual(byTag.body.bookmarks.map((b) => b.title), ['Docs']);

  const byNotes = await req(s.base, '/api/bookmarks?q=weekend');
  assert.deepEqual(byNotes.body.bookmarks.map((b) => b.title), ['Blog']);

  const none = await req(s.base, '/api/bookmarks?q=zzznothing');
  assert.deepEqual(none.body.bookmarks, []); // FR-012 no-results
  await s.close();
});

test('GET ?tag= filters to tagged bookmarks and /tags lists in-use tags (FR-010)', async () => {
  const s = await makeServer();
  await req(s.base, '/api/bookmarks', { method: 'POST', body: JSON.stringify({ url: 'a.com', tags: ['work'] }) });
  await req(s.base, '/api/bookmarks', { method: 'POST', body: JSON.stringify({ url: 'b.com', tags: ['personal'] }) });

  const filtered = await req(s.base, '/api/bookmarks?tag=work');
  assert.equal(filtered.body.bookmarks.length, 1);
  assert.equal(filtered.body.bookmarks[0].url, 'https://a.com/');

  const tags = await req(s.base, '/api/tags');
  assert.deepEqual(tags.body.tags, ['personal', 'work']);
  await s.close();
});
