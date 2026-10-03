import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { makeApp, withServer, closeShared } from './helpers.js';

after(() => closeShared());

test('PATCH updates fields and tags', async () => {
  await withServer(makeApp(), async (req) => {
    const { body: created } = await req('POST', '/api/bookmarks', { url: 'example.com/a' });
    const id = created.bookmark.id;
    const { status, body } = await req('PATCH', `/api/bookmarks/${id}`, {
      title: 'New Title',
      description: 'New desc',
      tags: ['alpha'],
    });
    assert.equal(status, 200);
    assert.equal(body.bookmark.title, 'New Title');
    assert.equal(body.bookmark.description, 'New desc');
    assert.deepEqual(body.bookmark.tags, ['alpha']);
  });
});

test('PATCH to a URL used by another bookmark returns 409', async () => {
  await withServer(makeApp(), async (req) => {
    const a = await req('POST', '/api/bookmarks', { url: 'example.com/a' });
    await req('POST', '/api/bookmarks', { url: 'example.com/b' });
    const { status, body } = await req('PATCH', `/api/bookmarks/${a.body.bookmark.id}`, {
      url: 'example.com/b',
    });
    assert.equal(status, 409);
    assert.ok(body.id);
  });
});

test('PATCH invalid url returns 400, missing bookmark 404', async () => {
  await withServer(makeApp(), async (req) => {
    const a = await req('POST', '/api/bookmarks', { url: 'example.com/a' });
    const bad = await req('PATCH', `/api/bookmarks/${a.body.bookmark.id}`, { url: 'notaurl' });
    assert.equal(bad.status, 400);
    const missing = await req('PATCH', '/api/bookmarks/99999', { title: 'x' });
    assert.equal(missing.status, 404);
  });
});

test('DELETE removes a bookmark (204) then 404', async () => {
  await withServer(makeApp(), async (req) => {
    const a = await req('POST', '/api/bookmarks', { url: 'example.com/a' });
    const id = a.body.bookmark.id;
    const del = await req('DELETE', `/api/bookmarks/${id}`);
    assert.equal(del.status, 204);
    const again = await req('DELETE', `/api/bookmarks/${id}`);
    assert.equal(again.status, 404);
    const list = await req('GET', '/api/bookmarks');
    assert.equal(list.body.total, 0);
  });
});
