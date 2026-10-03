'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { openDb, createDataStore } = require('../../src/db');
const { createApp } = require('../../src/server');

// Stub metadata fetch so tests never hit the network.
const stubFetch = async (url) => {
  if (url.includes('broken')) throw new Error('boom');
  return {
    ok: true,
    headers: { get: () => 'text/html' },
    text: async () => '<title>Stub Title</title><meta name="description" content="Stub description.">',
  };
};

function startServer() {
  const store = createDataStore(openDb(':memory:'));
  const app = createApp(store, { fetchImpl: stubFetch });
  return new Promise((resolve) => {
    const srv = app.listen(0, '127.0.0.1', () => {
      resolve({ srv, base: `http://127.0.0.1:${srv.address().port}`, store });
    });
  });
}

// Minimal cookie-aware client.
function makeClient(base) {
  let cookie = '';
  return async function call(method, path, body) {
    const headers = {};
    if (cookie) headers.Cookie = cookie;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const res = await fetch(base + path, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
    const setc = res.headers.get('set-cookie');
    if (setc) cookie = setc.split(';')[0];
    let data = null; try { data = await res.json(); } catch {}
    return { status: res.status, data };
  };
}

test('full API flow across scenarios', async (t) => {
  const { srv, base, store } = await startServer();
  t.after(() => { srv.close(); store.db.close(); if (global.gc) { global.gc(); global.gc(); } });
  const c = makeClient(base);

  await t.test('unauthenticated access is blocked (SCN-013)', async () => {
    const r = await c('GET', '/api/bookmarks');
    assert.strictEqual(r.status, 401);
  });

  await t.test('wrong login is rejected with message (SCN-013)', async () => {
    const r = await c('POST', '/api/login', { email: 'demo@x.com', password: 'nope' });
    assert.strictEqual(r.status, 401);
    assert.match(r.data.error, /isn.t right/);
  });

  await t.test('register then see own (empty) collection (SCN-005/013)', async () => {
    const reg = await c('POST', '/api/register', { email: 'demo@x.com', password: 'demo123' });
    assert.strictEqual(reg.status, 200);
    const list = await c('GET', '/api/bookmarks');
    assert.deepStrictEqual(list.data.bookmarks, []);
  });

  let id;
  await t.test('save a bookmark with tags and note (SCN-001/002/008)', async () => {
    const r = await c('POST', '/api/bookmarks', { url: 'https://github.com/pallets/flask', title: 'Flask', description: 'd', note: 'routing', tags: ['python', 'reference'] });
    assert.strictEqual(r.status, 201);
    id = r.data.bookmark.id;
    assert.deepStrictEqual(r.data.bookmark.tags, ['python', 'reference']);
    assert.strictEqual(r.data.bookmark.finished, false);
    assert.strictEqual(r.data.bookmark.archived, false);
  });

  await t.test('invalid link is rejected (SCN-009)', async () => {
    const r = await c('POST', '/api/bookmarks', { url: 'not a link' });
    assert.strictEqual(r.status, 400);
  });

  await t.test('duplicate save returns the existing bookmark (SCN-006)', async () => {
    const r = await c('POST', '/api/bookmarks', { url: 'https://GitHub.com/pallets/flask/' });
    assert.strictEqual(r.status, 409);
    assert.ok(r.data.duplicate);
    assert.strictEqual(r.data.bookmark.id, id);
  });

  await t.test('different path capitalisation is a new bookmark (SCN-006)', async () => {
    const r = await c('POST', '/api/bookmarks', { url: 'https://github.com/pallets/Flask' });
    assert.strictEqual(r.status, 201);
    assert.notStrictEqual(r.data.bookmark.id, id);
  });

  await t.test('metadata auto-fill succeeds and fails gracefully (SCN-001/009)', async () => {
    const ok = await c('GET', '/api/metadata?url=' + encodeURIComponent('https://example.com'));
    assert.strictEqual(ok.data.ok, true);
    assert.strictEqual(ok.data.title, 'Stub Title');
    const bad = await c('GET', '/api/metadata?url=' + encodeURIComponent('https://broken.example.com'));
    assert.strictEqual(bad.data.ok, false);
    assert.strictEqual(bad.data.title, '');
  });

  await t.test('edit fields including address (SCN-007)', async () => {
    const r = await c('PUT', '/api/bookmarks/' + id, { url: 'https://github.com/pallets/flask', title: 'Flask (edited)', description: 'd2', note: 'n2', tags: ['python'] });
    assert.strictEqual(r.status, 200);
    assert.strictEqual(r.data.bookmark.title, 'Flask (edited)');
  });

  await t.test('editing to a colliding address is blocked (SCN-007)', async () => {
    const r = await c('PUT', '/api/bookmarks/' + id, { url: 'https://github.com/pallets/Flask' });
    assert.strictEqual(r.status, 409);
    assert.match(r.data.error, /already uses this address/);
  });

  await t.test('status, archive and delete (SCN-003/011/012)', async () => {
    assert.strictEqual((await c('PATCH', `/api/bookmarks/${id}/status`, { finished: true })).data.bookmark.finished, true);
    assert.strictEqual((await c('PATCH', `/api/bookmarks/${id}/archived`, { archived: true })).data.bookmark.archived, true);
    assert.strictEqual((await c('PATCH', `/api/bookmarks/${id}/archived`, { archived: false })).data.bookmark.archived, false);
    assert.strictEqual((await c('DELETE', '/api/bookmarks/' + id)).status, 200);
  });

  await t.test('another account cannot see the first account bookmarks (SCN-013)', async () => {
    const c2 = makeClient(base);
    await c2('POST', '/api/register', { email: 'other@x.com', password: 'demo123' });
    const list = await c2('GET', '/api/bookmarks');
    assert.deepStrictEqual(list.data.bookmarks, []);
  });
});
