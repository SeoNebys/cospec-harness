import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, resetDb, postBookmark } from './helpers.js';

let ctx;

before(async () => {
  ctx = await startServer();
});

after(async () => {
  await ctx.close();
});

beforeEach(() => {
  resetDb();
});

test('creates a bookmark and returns the normalized representation', async () => {
  const { status, body } = await postBookmark(ctx.base, {
    url: 'https://example.com/article',
    title: 'A good article',
    tags: ['reading'],
  });
  assert.equal(status, 201);
  assert.equal(body.bookmark.url, 'https://example.com/article');
  assert.equal(body.bookmark.title, 'A good article');
  assert.deepEqual(body.bookmark.tags, ['reading']);
  assert.ok(body.bookmark.created_at);
  assert.equal(body.warning, undefined);
});

test('defaults a blank title to the normalized url (VR-3)', async () => {
  const { status, body } = await postBookmark(ctx.base, {
    url: 'https://example.com',
    title: '   ',
  });
  assert.equal(status, 201);
  assert.equal(body.bookmark.title, 'https://example.com/');
});

test('normalizes an address with no scheme to https (VR-2)', async () => {
  const { status, body } = await postBookmark(ctx.base, { url: 'example.com' });
  assert.equal(status, 201);
  assert.equal(body.bookmark.url, 'https://example.com/');
});

test('rejects an invalid address with 400 invalid_url (FR-002)', async () => {
  const { status, body } = await postBookmark(ctx.base, { url: 'not a url' });
  assert.equal(status, 400);
  assert.equal(body.error, 'invalid_url');
  assert.ok(body.message);
});

test('rejects a non-http scheme (FR-002)', async () => {
  const { status, body } = await postBookmark(ctx.base, {
    url: 'ftp://files.example.com',
  });
  assert.equal(status, 400);
  assert.equal(body.error, 'invalid_url');
});

test('warns but still saves a duplicate url (FR-013)', async () => {
  await postBookmark(ctx.base, { url: 'https://dup.example.com' });
  const { status, body } = await postBookmark(ctx.base, {
    url: 'https://dup.example.com',
  });
  assert.equal(status, 201);
  assert.equal(body.warning, 'duplicate_url');
});

test('normalizes and dedupes tags (VR-4)', async () => {
  const { body } = await postBookmark(ctx.base, {
    url: 'https://tags.example.com',
    tags: ['Tech', 'tech ', '  ', 'Reading'],
  });
  assert.deepEqual(body.bookmark.tags, ['tech', 'reading']);
});

test('accepts comma-separated tags as a string', async () => {
  const { body } = await postBookmark(ctx.base, {
    url: 'https://commatags.example.com',
    tags: 'a, b ,a',
  });
  assert.deepEqual(body.bookmark.tags, ['a', 'b']);
});
