import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { makeApp, withServer, closeShared } from './helpers.js';

after(() => closeShared());

test('search matches title, description, url and tag', async () => {
  const app = makeApp({
    byUrl: (url) => {
      if (url.includes('/cats')) return { title: 'All about cats', description: 'feline facts' };
      return { title: 'Other', description: 'nothing here' };
    },
  });
  await withServer(app, async (req) => {
    await req('POST', '/api/bookmarks', { url: 'example.com/cats', tags: ['animals'] });
    await req('POST', '/api/bookmarks', { url: 'example.com/other' });

    const byTitle = await req('GET', '/api/bookmarks?q=cats');
    assert.equal(byTitle.body.total, 1);

    const byDesc = await req('GET', '/api/bookmarks?q=feline');
    assert.equal(byDesc.body.total, 1);

    const byTag = await req('GET', '/api/bookmarks?q=animals');
    assert.equal(byTag.body.total, 1);

    const byUrl = await req('GET', '/api/bookmarks?q=other');
    assert.equal(byUrl.body.total, 1);
  });
});

test('search combines with tag filter', async () => {
  await withServer(makeApp(), async (req) => {
    await req('POST', '/api/bookmarks', { url: 'example.com/a', tags: ['work'] });
    await req('POST', '/api/bookmarks', { url: 'example.com/b', tags: ['work'] });
    await req('POST', '/api/bookmarks', { url: 'example.com/a2', tags: ['home'] });
    const { body } = await req('GET', '/api/bookmarks?tag=work&q=/a');
    assert.equal(body.total, 1);
    assert.equal(body.bookmarks[0].url, 'https://example.com/a');
  });
});

test('no matches returns empty list', async () => {
  await withServer(makeApp(), async (req) => {
    await req('POST', '/api/bookmarks', { url: 'example.com/a' });
    const { body } = await req('GET', '/api/bookmarks?q=zzzznotfound');
    assert.deepEqual(body.bookmarks, []);
  });
});
