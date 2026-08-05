'use strict';

// Scenario-level acceptance tests. Drive the real HTTP API end to end with a
// temp store and a fake page-name lookup (no real network), one test block per
// approved scenario.

const { test } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { Store } = require('../src/store');
const { createApp } = require('../src/app');

// Fake title lookup: known URLs resolve to a name; anything containing
// "no-title" resolves to null (name not found).
function fakeFetchTitle(map) {
  return async (url) => {
    if (/no-title/.test(url)) return null;
    for (const key of Object.keys(map)) {
      if (url.includes(key)) return map[key];
    }
    return 'Some Page';
  };
}

async function startServer(titleMap) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bm-acc-'));
  const store = new Store(path.join(dir, 'bookmarks.json'));
  const app = createApp({ store, fetchTitle: fakeFetchTitle(titleMap || {}) });
  const server = http.createServer(app);
  await new Promise((r) => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;
  return {
    base,
    store,
    async req(method, p, body) {
      const res = await fetch(base + p, {
        method,
        headers: body ? { 'content-type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json().catch(() => ({}));
      return { status: res.status, data };
    },
    close: () => new Promise((r) => server.close(r)),
  };
}

test('SCN-005: a brand-new user has an empty list', async () => {
  const s = await startServer();
  const { status, data } = await s.req('GET', '/api/bookmarks');
  assert.equal(status, 200);
  assert.deepEqual(data.bookmarks, []);
  await s.close();
});

test('SCN-001: saving a link stores it with its found page name, newest first', async () => {
  const s = await startServer({ 'coffeeweekly.com': 'Perfect Espresso — Coffee Weekly' });
  const r1 = await s.req('POST', '/api/bookmarks', { url: 'https://coffeeweekly.com/x' });
  assert.equal(r1.status, 201);
  assert.equal(r1.data.bookmark.title, 'Perfect Espresso — Coffee Weekly');
  assert.equal(r1.data.bookmark.nameStatus, 'found');

  await s.req('POST', '/api/bookmarks', { url: 'https://second.com/y' });
  const list = (await s.req('GET', '/api/bookmarks')).data.bookmarks;
  assert.equal(list.length, 2);
  assert.equal(list[0].url, 'https://second.com/y'); // newest on top
  await s.close();
});

test('SCN-006: a link with no findable name is saved with a fallback name', async () => {
  const s = await startServer();
  const { status, data } = await s.req('POST', '/api/bookmarks', { url: 'https://no-title.example.com/x8f2' });
  assert.equal(status, 201);
  assert.equal(data.bookmark.nameStatus, 'fallback');
  assert.equal(data.bookmark.title, 'https://no-title.example.com/x8f2'); // address stands in
  await s.close();
});

test('SCN-007: non-link text is still savable via the API (warning is client-side)', async () => {
  const s = await startServer();
  const { status, data } = await s.req('POST', '/api/bookmarks', { url: 'dinner ideas' });
  assert.equal(status, 201);
  assert.equal(data.looksLikeLink, false); // server flags that it did not look like a link
  await s.close();
});

test('SCN-008: saving a duplicate does not create a copy and points to the original', async () => {
  const s = await startServer({ 'coffeeweekly.com': 'Coffee Weekly' });
  const first = await s.req('POST', '/api/bookmarks', { url: 'https://coffeeweekly.com/perfect-espresso' });
  const dup = await s.req('POST', '/api/bookmarks', { url: 'HTTP://coffeeweekly.com/perfect-espresso/' });
  assert.equal(dup.status, 200);
  assert.equal(dup.data.duplicate, true);
  assert.equal(dup.data.bookmark.id, first.data.bookmark.id);
  const list = (await s.req('GET', '/api/bookmarks')).data.bookmarks;
  assert.equal(list.length, 1); // count unchanged
  await s.close();
});

test('SCN-002: renaming updates the name and marks it custom; empty is rejected', async () => {
  const s = await startServer();
  const b = (await s.req('POST', '/api/bookmarks', { url: 'https://no-title.example.com/z' })).data.bookmark;
  assert.equal(b.nameStatus, 'fallback');
  const renamed = await s.req('PATCH', '/api/bookmarks/' + b.id, { title: 'Longreads article' });
  assert.equal(renamed.status, 200);
  assert.equal(renamed.data.bookmark.title, 'Longreads article');
  assert.equal(renamed.data.bookmark.nameStatus, 'custom');

  const empty = await s.req('PATCH', '/api/bookmarks/' + b.id, { title: '   ' });
  assert.equal(empty.status, 400); // empty keeps the old name
  await s.close();
});

test('SCN-004: removing returns position, and restore (undo) puts it back in place', async () => {
  const s = await startServer();
  const a = (await s.req('POST', '/api/bookmarks', { url: 'https://a.com' })).data.bookmark;
  const b = (await s.req('POST', '/api/bookmarks', { url: 'https://b.com' })).data.bookmark;
  const c = (await s.req('POST', '/api/bookmarks', { url: 'https://c.com' })).data.bookmark;
  // order: c, b, a
  const del = await s.req('DELETE', '/api/bookmarks/' + b.id);
  assert.equal(del.status, 200);
  assert.equal(del.data.index, 1);
  let list = (await s.req('GET', '/api/bookmarks')).data.bookmarks;
  assert.deepEqual(list.map((x) => x.url), ['https://c.com', 'https://a.com']);

  const undo = await s.req('POST', '/api/bookmarks/' + b.id + '/restore', { bookmark: del.data.bookmark, index: del.data.index });
  assert.equal(undo.status, 200);
  list = (await s.req('GET', '/api/bookmarks')).data.bookmarks;
  assert.deepEqual(list.map((x) => x.url), ['https://c.com', 'https://b.com', 'https://a.com']);
  await s.close();
});

test('SCN-009: saved links persist to disk (a fresh Store on the same file sees them)', async () => {
  const s = await startServer({ 'keep.com': 'Keep me' });
  await s.req('POST', '/api/bookmarks', { url: 'https://keep.com/a' });
  const reopened = new Store(s.store.filePath); // simulate closing and reopening
  assert.equal(reopened.list().length, 1);
  assert.equal(reopened.list()[0].title, 'Keep me');
  await s.close();
});

test('renaming or deleting a missing link returns 404', async () => {
  const s = await startServer();
  assert.equal((await s.req('PATCH', '/api/bookmarks/none', { title: 'x' })).status, 404);
  assert.equal((await s.req('DELETE', '/api/bookmarks/none')).status, 404);
  await s.close();
});
