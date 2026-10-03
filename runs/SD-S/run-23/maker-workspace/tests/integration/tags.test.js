import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { makeApp, withServer, closeShared } from './helpers.js';

after(() => closeShared());

test('GET /api/tags lists distinct tags', async () => {
  await withServer(makeApp(), async (req) => {
    await req('POST', '/api/bookmarks', { url: 'example.com/a', tags: ['work', 'reading'] });
    await req('POST', '/api/bookmarks', { url: 'example.com/b', tags: ['work'] });
    const { body } = await req('GET', '/api/tags');
    assert.deepEqual(body.tags, ['reading', 'work']);
  });
});

test('tags de-duplicate case-insensitively', async () => {
  await withServer(makeApp(), async (req) => {
    await req('POST', '/api/bookmarks', { url: 'example.com/a', tags: ['Work'] });
    await req('POST', '/api/bookmarks', { url: 'example.com/b', tags: ['work'] });
    const { body } = await req('GET', '/api/tags');
    assert.equal(body.tags.length, 1);
  });
});

test('filter by tag returns only matching bookmarks (case-insensitive)', async () => {
  await withServer(makeApp(), async (req) => {
    await req('POST', '/api/bookmarks', { url: 'example.com/a', tags: ['work'] });
    await req('POST', '/api/bookmarks', { url: 'example.com/b', tags: ['home'] });
    const { body } = await req('GET', '/api/bookmarks?tag=WORK');
    assert.equal(body.total, 1);
    assert.equal(body.bookmarks[0].url, 'https://example.com/a');
  });
});
