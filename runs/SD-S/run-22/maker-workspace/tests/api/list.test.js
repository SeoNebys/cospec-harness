import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, stopServer, req } from './helpers.js';

before(async () => {
  await startServer();
  await req('POST', '/api/bookmarks', { url: 'https://a.test', title: 'Alpha docs', tags: ['docs'] });
  await req('POST', '/api/bookmarks', { url: 'https://b.test', title: 'Beta guide', tags: ['guide'] });
  await req('POST', '/api/bookmarks', { url: 'https://c.test/alpha', title: 'Gamma', tags: [] });
});
after(stopServer);

test('lists all bookmarks newest-first', async () => {
  const { status, body } = await req('GET', '/api/bookmarks');
  assert.equal(status, 200);
  assert.equal(body.bookmarks.length, 3);
  assert.deepEqual(
    body.bookmarks.map((b) => b.title),
    ['Gamma', 'Beta guide', 'Alpha docs']
  );
});

test('search matches title', async () => {
  const { body } = await req('GET', '/api/bookmarks?q=beta');
  assert.equal(body.bookmarks.length, 1);
  assert.equal(body.bookmarks[0].title, 'Beta guide');
});

test('search matches url', async () => {
  const { body } = await req('GET', '/api/bookmarks?q=c.test');
  assert.equal(body.bookmarks.length, 1);
  assert.equal(body.bookmarks[0].title, 'Gamma');
});

test('search matches tag name', async () => {
  const { body } = await req('GET', '/api/bookmarks?q=docs');
  assert.equal(body.bookmarks.length, 1);
  assert.equal(body.bookmarks[0].title, 'Alpha docs');
});

test('non-matching search returns an empty array, not an error', async () => {
  const { status, body } = await req('GET', '/api/bookmarks?q=zzzznotfound');
  assert.equal(status, 200);
  assert.deepEqual(body.bookmarks, []);
});
