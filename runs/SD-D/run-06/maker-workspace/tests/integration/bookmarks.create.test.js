import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer } from './helper.js';

let srv;
before(async () => { srv = await startTestServer(); });
after(async () => { await srv.close(); });

test('create -> list -> get -> edit title persists (US1)', async () => {
  const created = await srv.api('POST', '/api/bookmarks', { url: 'example.com/page', title: 'My Page' });
  assert.equal(created.status, 201);
  const id = created.data.bookmark.id;
  assert.equal(created.data.bookmark.title, 'My Page');
  assert.equal(created.data.bookmark.url, 'https://example.com/page');

  const list = await srv.api('GET', '/api/bookmarks');
  assert.equal(list.data.total, 1);
  assert.equal(list.data.items[0].id, id);

  const got = await srv.api('GET', `/api/bookmarks/${id}`);
  assert.equal(got.status, 200);

  const patched = await srv.api('PATCH', `/api/bookmarks/${id}`, { title: 'Renamed' });
  assert.equal(patched.status, 200);
  assert.equal(patched.data.bookmark.title, 'Renamed');

  const after = await srv.api('GET', `/api/bookmarks/${id}`);
  assert.equal(after.data.bookmark.title, 'Renamed');
});

test('invalid URL is rejected with 400 (FR-002)', async () => {
  const res = await srv.api('POST', '/api/bookmarks', { url: 'not a url' });
  assert.equal(res.status, 400);
  assert.equal(res.data.error.code, 'invalid_url');
});

test('missing title falls back to host (FR-003)', async () => {
  const res = await srv.api('POST', '/api/bookmarks', { url: 'https://fallback.example/x' });
  assert.equal(res.status, 201);
  assert.equal(res.data.bookmark.title, 'fallback.example');
});

test('tags and notes round-trip through create + edit (US3/US8)', async () => {
  const res = await srv.api('POST', '/api/bookmarks', { url: 'https://tagged.example', tags: ['news', 'tech'], notesMarkdown: '**bold**' });
  const b = res.data.bookmark;
  assert.deepEqual(b.tags.sort(), ['news', 'tech']);
  assert.match(b.notesHtml, /<strong>bold<\/strong>/);
});
