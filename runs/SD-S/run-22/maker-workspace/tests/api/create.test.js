import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, stopServer, req } from './helpers.js';

before(startServer);
after(stopServer);

test('creates a bookmark with a valid url and explicit title', async () => {
  const { status, body } = await req('POST', '/api/bookmarks', {
    url: 'example.com/article',
    title: 'My Article',
    tags: ['reading'],
  });
  assert.equal(status, 201);
  assert.equal(body.bookmark.url, 'https://example.com/article');
  assert.equal(body.bookmark.title, 'My Article');
  assert.deepEqual(body.bookmark.tags, ['reading']);
  assert.ok(body.bookmark.createdAt);
  assert.equal(body.warnings, undefined);
});

test('derives a non-empty title when none is provided', async () => {
  const { status, body } = await req('POST', '/api/bookmarks', {
    url: 'https://title-derivation-example.test/page',
  });
  assert.equal(status, 201);
  assert.ok(body.bookmark.title && body.bookmark.title.length > 0);
});

test('rejects an invalid/empty url with 400 invalid_url', async () => {
  const empty = await req('POST', '/api/bookmarks', { url: '' });
  assert.equal(empty.status, 400);
  assert.equal(empty.body.error.code, 'invalid_url');

  const bad = await req('POST', '/api/bookmarks', { url: 'ftp://nope' });
  assert.equal(bad.status, 400);
  assert.equal(bad.body.error.code, 'invalid_url');
});

test('warns but still saves when the url is a duplicate', async () => {
  const first = await req('POST', '/api/bookmarks', {
    url: 'https://dup.test/x',
    title: 'First',
  });
  assert.equal(first.status, 201);

  const second = await req('POST', '/api/bookmarks', {
    url: 'https://dup.test/x',
    title: 'Second',
  });
  assert.equal(second.status, 201);
  assert.ok(second.body.warnings.includes('duplicate_url'));
});
