const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { BookmarkStore } = require('../src/store');
const { createApp } = require('../src/server');

async function fixture(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'pocketmark-api-'));
  const store = new BookmarkStore(path.join(directory, 'bookmarks.json'));
  const server = createApp({
    store,
    metadataFetcher: async (url) => ({ title: `Title for ${new URL(url).hostname}`, description: 'Fetched description' }),
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(directory, { recursive: true, force: true });
  });
  const request = async (pathname, options = {}) => {
    const response = await fetch(`${base}${pathname}`, { ...options, headers: { 'content-type': 'application/json', ...(options.headers || {}) } });
    return { response, body: await response.json() };
  };
  return { request, store, base };
}

test('metadata, create, list, update, read-later, and delete APIs form a complete lifecycle', async (t) => {
  const { request } = await fixture(t);
  const metadata = await request('/api/metadata', { method: 'POST', body: JSON.stringify({ url: 'https://example.com/article' }) });
  assert.equal(metadata.response.status, 200);
  assert.equal(metadata.body.title, 'Title for example.com');

  const created = await request('/api/bookmarks', { method: 'POST', body: JSON.stringify({
    url: 'https://example.com/article', title: metadata.body.title, description: metadata.body.description, tags: ['Reading'],
  }) });
  assert.equal(created.response.status, 201);
  const id = created.body.bookmark.id;

  const duplicate = await request('/api/bookmarks', { method: 'POST', body: JSON.stringify({ url: 'https://example.com/article/', title: 'Copy' }) });
  assert.equal(duplicate.response.status, 409);
  assert.equal(duplicate.body.existing.id, id);

  const later = await request(`/api/bookmarks/${id}/read-later`, { method: 'PATCH', body: JSON.stringify({ isReadLater: true }) });
  assert.equal(later.body.bookmark.isReadLater, true);

  const updated = await request(`/api/bookmarks/${id}`, { method: 'PUT', body: JSON.stringify({
    url: 'https://example.com/corrected', title: 'Corrected', description: 'Better', tags: ['Reading', 'Health'], isReadLater: true,
  }) });
  assert.equal(updated.body.bookmark.title, 'Corrected');
  assert.equal(updated.body.bookmark.isReadLater, true);
  assert.equal(updated.body.bookmark.createdAt, created.body.bookmark.createdAt);

  const listed = await request('/api/bookmarks');
  assert.equal(listed.body.bookmarks.length, 1);
  assert.deepEqual(listed.body.bookmarks[0].tags, ['Reading', 'Health']);

  const removed = await request(`/api/bookmarks/${id}`, { method: 'DELETE' });
  assert.equal(removed.response.status, 200);
  assert.equal((await request('/api/bookmarks')).body.bookmarks.length, 0);
});

test('invalid values return clear client errors and leave stored data unchanged', async (t) => {
  const { request, store } = await fixture(t);
  const created = (await request('/api/bookmarks', { method: 'POST', body: JSON.stringify({ url: 'https://example.com', title: 'Good' }) })).body.bookmark;
  const invalid = await request(`/api/bookmarks/${created.id}`, { method: 'PUT', body: JSON.stringify({ url: 'walking', title: '' }) });
  assert.equal(invalid.response.status, 400);
  assert.equal(store.find(created.id).title, 'Good');
});
