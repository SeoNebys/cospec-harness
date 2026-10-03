import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, stopServer, req } from './helpers.js';

before(async () => {
  await startServer();
  await req('POST', '/api/bookmarks', { url: 'https://one.test', title: 'One', tags: ['work', 'reading'] });
  await req('POST', '/api/bookmarks', { url: 'https://two.test', title: 'Two', tags: ['work'] });
  await req('POST', '/api/bookmarks', { url: 'https://three.test', title: 'Three', tags: ['fun'] });
});
after(stopServer);

test('filters by tag returns only bookmarks carrying that tag', async () => {
  const { status, body } = await req('GET', '/api/bookmarks?tag=work');
  assert.equal(status, 200);
  assert.equal(body.bookmarks.length, 2);
  assert.deepEqual(
    body.bookmarks.map((b) => b.title).sort(),
    ['One', 'Two']
  );
});

test('tag filter is case-insensitive', async () => {
  const { body } = await req('GET', '/api/bookmarks?tag=WORK');
  assert.equal(body.bookmarks.length, 2);
});

test('GET /api/tags returns all distinct tags', async () => {
  const { body } = await req('GET', '/api/tags');
  assert.deepEqual(body.tags.sort(), ['fun', 'reading', 'work']);
});
