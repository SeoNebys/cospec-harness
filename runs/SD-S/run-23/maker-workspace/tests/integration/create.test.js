import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { makeApp, withServer, closeShared } from './helpers.js';

after(() => closeShared());

test('POST creates a bookmark with auto-collected details (201)', async () => {
  await withServer(makeApp({ title: 'Fetched Title' }), async (req) => {
    const { status, body } = await req('POST', '/api/bookmarks', { url: 'example.com/a' });
    assert.equal(status, 201);
    assert.equal(body.existed, false);
    assert.equal(body.bookmark.url, 'https://example.com/a');
    assert.equal(body.bookmark.title, 'Fetched Title');
  });
});

test('POST normalizes scheme', async () => {
  await withServer(makeApp(), async (req) => {
    const { body } = await req('POST', '/api/bookmarks', { url: 'example.com' });
    assert.equal(body.bookmark.url, 'https://example.com/');
  });
});

test('POST duplicate returns existing bookmark with existed:true (200)', async () => {
  await withServer(makeApp(), async (req) => {
    const first = await req('POST', '/api/bookmarks', { url: 'example.com/dup' });
    const second = await req('POST', '/api/bookmarks', { url: 'https://example.com/dup' });
    assert.equal(second.status, 200);
    assert.equal(second.body.existed, true);
    assert.equal(second.body.bookmark.id, first.body.bookmark.id);
  });
});

test('POST rejects missing/invalid url (400)', async () => {
  await withServer(makeApp(), async (req) => {
    const empty = await req('POST', '/api/bookmarks', { url: '' });
    assert.equal(empty.status, 400);
    const bad = await req('POST', '/api/bookmarks', { url: 'notaurl' });
    assert.equal(bad.status, 400);
  });
});

test('save succeeds even when metadata collection returns nothing', async () => {
  const app = makeApp({ title: '', description: '', faviconUrl: '' });
  await withServer(app, async (req) => {
    const { status, body } = await req('POST', '/api/bookmarks', { url: 'example.com/x' });
    assert.equal(status, 201);
    // title falls back to host
    assert.equal(body.bookmark.title, 'example.com');
  });
});

test('user-supplied tags are attached on create', async () => {
  await withServer(makeApp(), async (req) => {
    const { body } = await req('POST', '/api/bookmarks', {
      url: 'example.com/t',
      tags: ['Work', 'reading'],
    });
    const sorted = [...body.bookmark.tags].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
    assert.deepEqual(sorted, ['reading', 'Work']);
  });
});
