import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer, jsonRequest } from './helper.js';

let server;

before(async () => {
  server = await startTestServer();
  await jsonRequest(server.base, '/api/bookmarks', {
    method: 'POST',
    body: JSON.stringify({
      url: 'https://work1.example.com',
      title: 'Work one',
      tags: ['work', 'urgent'],
    }),
  });
  await jsonRequest(server.base, '/api/bookmarks', {
    method: 'POST',
    body: JSON.stringify({
      url: 'https://home1.example.com',
      title: 'Home one',
      tags: ['home'],
    }),
  });
});
after(async () => {
  await server.close();
});

test('tags are stored and returned on the bookmark', async () => {
  const { body } = await jsonRequest(server.base, '/api/bookmarks?q=Work one');
  assert.deepEqual(body.bookmarks[0].tags, ['urgent', 'work']); // sorted
});

test('GET /api/bookmarks?tag= filters to that tag', async () => {
  const { body } = await jsonRequest(server.base, '/api/bookmarks?tag=work');
  assert.equal(body.bookmarks.length, 1);
  assert.equal(body.bookmarks[0].title, 'Work one');
});

test('tag filter is case-insensitive', async () => {
  const { body } = await jsonRequest(server.base, '/api/bookmarks?tag=WORK');
  assert.equal(body.bookmarks.length, 1);
});

test('GET /api/tags lists tag names in use', async () => {
  const { body } = await jsonRequest(server.base, '/api/tags');
  assert.deepEqual(body.tags, ['home', 'urgent', 'work']);
});

test('PATCH can replace a bookmark\'s tags', async () => {
  const list = await jsonRequest(server.base, '/api/bookmarks?tag=home');
  const id = list.body.bookmarks[0].id;
  const { body } = await jsonRequest(server.base, `/api/bookmarks/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ tags: ['relocated'] }),
  });
  assert.deepEqual(body.tags, ['relocated']);
  const homeAfter = await jsonRequest(server.base, '/api/bookmarks?tag=home');
  assert.equal(homeAfter.body.bookmarks.length, 0);
});
