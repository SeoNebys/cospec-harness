import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, stopServer, req } from './helpers.js';

before(startServer);
after(stopServer);

async function makeBookmark() {
  const { body } = await req('POST', '/api/bookmarks', {
    url: 'https://edit.test/x',
    title: 'Original',
    tags: ['one'],
  });
  return body.bookmark;
}

test('updates title, note and tags and bumps updatedAt', async () => {
  const created = await makeBookmark();
  // ensure a measurable time difference
  await new Promise((r) => setTimeout(r, 5));
  const { status, body } = await req('PUT', `/api/bookmarks/${created.id}`, {
    title: 'Updated title',
    note: 'a note',
    tags: ['one', 'two'],
  });
  assert.equal(status, 200);
  assert.equal(body.bookmark.title, 'Updated title');
  assert.equal(body.bookmark.note, 'a note');
  assert.deepEqual(body.bookmark.tags, ['one', 'two']);
  assert.equal(body.bookmark.url, created.url, 'url is not editable');
  assert.notEqual(body.bookmark.updatedAt, created.updatedAt);
});

test('rejects an empty title on update with 400 invalid_title', async () => {
  const created = await makeBookmark();
  const { status, body } = await req('PUT', `/api/bookmarks/${created.id}`, {
    title: '   ',
  });
  assert.equal(status, 400);
  assert.equal(body.error.code, 'invalid_title');
});

test('unknown id returns 404 not_found for get/put/delete', async () => {
  const get = await req('GET', '/api/bookmarks/999999');
  assert.equal(get.status, 404);
  assert.equal(get.body.error.code, 'not_found');

  const put = await req('PUT', '/api/bookmarks/999999', { title: 'x' });
  assert.equal(put.status, 404);

  const del = await req('DELETE', '/api/bookmarks/999999');
  assert.equal(del.status, 404);
});

test('deletes a bookmark and removes it from the list', async () => {
  const created = await makeBookmark();
  const del = await req('DELETE', `/api/bookmarks/${created.id}`);
  assert.equal(del.status, 204);

  const get = await req('GET', `/api/bookmarks/${created.id}`);
  assert.equal(get.status, 404);
});
