import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { makeApp, withServer, closeShared } from './helpers.js';

after(() => closeShared());

test('GET /api/bookmarks returns empty list initially', async () => {
  await withServer(makeApp(), async (req) => {
    const { status, body } = await req('GET', '/api/bookmarks');
    assert.equal(status, 200);
    assert.deepEqual(body.bookmarks, []);
    assert.equal(body.total, 0);
  });
});

test('GET returns bookmarks newest-first', async () => {
  await withServer(makeApp(), async (req) => {
    await req('POST', '/api/bookmarks', { url: 'example.com/first' });
    await new Promise((r) => setTimeout(r, 5));
    await req('POST', '/api/bookmarks', { url: 'example.com/second' });
    const { body } = await req('GET', '/api/bookmarks');
    assert.equal(body.total, 2);
    assert.equal(body.bookmarks[0].url, 'https://example.com/second');
    assert.equal(body.bookmarks[1].url, 'https://example.com/first');
  });
});
