'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { createApp } = require('../src/server');

// In-memory store and a stub title fetcher so tests are deterministic and
// offline. Each test gets a fresh app/server.
function memoryStore() {
  const state = { bookmarks: [], nextId: 1 };
  return {
    load: () => state,
    save: () => {},
    _state: state,
  };
}

const stubFetchTitle = async (url) => {
  if (url.indexOf('notitle') !== -1) return { ok: false };
  return { ok: true, title: 'Title of ' + url };
};

function start() {
  const store = memoryStore();
  const app = createApp({ store, fetchTitle: stubFetchTitle });
  return new Promise((resolve) => {
    const server = app.listen(0, '127.0.0.1', () => {
      const base = 'http://127.0.0.1:' + server.address().port;
      resolve({ server, base, store });
    });
  });
}

function req(base, method, path, body) {
  return fetch(base + path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
}

test('SCN-001: saving a valid link fetches its title and lists newest first', async () => {
  const { server, base } = await start();
  try {
    let r = await req(base, 'POST', '/api/bookmarks', { url: 'example.com/a' });
    assert.strictEqual(r.status, 201);
    let d = await r.json();
    assert.strictEqual(d.bookmark.url, 'https://example.com/a');
    assert.strictEqual(d.bookmark.title, 'Title of https://example.com/a');
    assert.strictEqual(d.bookmark.titleFailed, false);

    await req(base, 'POST', '/api/bookmarks', { url: 'example.com/b' });
    r = await req(base, 'GET', '/api/bookmarks');
    d = await r.json();
    assert.strictEqual(d.bookmarks[0].url, 'https://example.com/b'); // newest first
    assert.strictEqual(d.total, 2);
  } finally { server.close(); }
});

test('SCN-001: renaming updates the title', async () => {
  const { server, base } = await start();
  try {
    const created = await (await req(base, 'POST', '/api/bookmarks', { url: 'example.com/a' })).json();
    const id = created.bookmark.id;
    const r = await req(base, 'PATCH', '/api/bookmarks/' + id, { title: 'My name' });
    const d = await r.json();
    assert.strictEqual(d.bookmark.title, 'My name');
  } finally { server.close(); }
});

test('SCN-005: invalid input is rejected with 400', async () => {
  const { server, base } = await start();
  try {
    const r = await req(base, 'POST', '/api/bookmarks', { url: 'not a link' });
    assert.strictEqual(r.status, 400);
  } finally { server.close(); }
});

test('SCN-005: a failed title fetch still saves, using the address', async () => {
  const { server, base } = await start();
  try {
    const r = await req(base, 'POST', '/api/bookmarks', { url: 'https://notitle.example.com/x' });
    assert.strictEqual(r.status, 201);
    const d = await r.json();
    assert.strictEqual(d.bookmark.titleFailed, true);
    assert.strictEqual(d.bookmark.title, 'https://notitle.example.com/x');
  } finally { server.close(); }
});

test('SCN-006: saving a duplicate returns 409 with the existing bookmark', async () => {
  const { server, base } = await start();
  try {
    const first = await (await req(base, 'POST', '/api/bookmarks', { url: 'example.com/a' })).json();
    const r = await req(base, 'POST', '/api/bookmarks', { url: 'https://example.com/a' });
    assert.strictEqual(r.status, 409);
    const d = await r.json();
    assert.strictEqual(d.duplicate, true);
    assert.strictEqual(d.bookmark.id, first.bookmark.id);
    // No second copy created.
    const list = await (await req(base, 'GET', '/api/bookmarks')).json();
    assert.strictEqual(list.total, 1);
  } finally { server.close(); }
});

test('SCN-002: tags are lower-cased, de-duplicated, and removable', async () => {
  const { server, base } = await start();
  try {
    const created = await (await req(base, 'POST', '/api/bookmarks', { url: 'example.com/a' })).json();
    const id = created.bookmark.id;
    let d = await (await req(base, 'PATCH', '/api/bookmarks/' + id, { tags: ['Article', 'article', 'PYTHON'] })).json();
    assert.deepStrictEqual(d.bookmark.tags, ['article', 'python']);
    d = await (await req(base, 'PATCH', '/api/bookmarks/' + id, { tags: ['python'] })).json();
    assert.deepStrictEqual(d.bookmark.tags, ['python']);
  } finally { server.close(); }
});

test('SCN-004: read-later opt-in and read status; leaving read-later clears read', async () => {
  const { server, base } = await start();
  try {
    // Default save is not read-later.
    const plain = await (await req(base, 'POST', '/api/bookmarks', { url: 'example.com/tool' })).json();
    assert.strictEqual(plain.bookmark.readLater, false);

    // Opt in at save time.
    const rl = await (await req(base, 'POST', '/api/bookmarks', { url: 'example.com/read', readLater: true })).json();
    const id = rl.bookmark.id;
    assert.strictEqual(rl.bookmark.readLater, true);
    assert.strictEqual(rl.bookmark.read, false);

    let d = await (await req(base, 'PATCH', '/api/bookmarks/' + id, { read: true })).json();
    assert.strictEqual(d.bookmark.read, true);

    // Removing from read-later clears read status.
    d = await (await req(base, 'PATCH', '/api/bookmarks/' + id, { readLater: false })).json();
    assert.strictEqual(d.bookmark.readLater, false);
    assert.strictEqual(d.bookmark.read, false);

    // unreadCount reflects only unread read-later items.
    const snap = await (await req(base, 'GET', '/api/bookmarks')).json();
    assert.strictEqual(snap.unreadCount, 0);
  } finally { server.close(); }
});

test('SCN-004: read status cannot be set on a non-read-later item', async () => {
  const { server, base } = await start();
  try {
    const created = await (await req(base, 'POST', '/api/bookmarks', { url: 'example.com/tool' })).json();
    const id = created.bookmark.id;
    const d = await (await req(base, 'PATCH', '/api/bookmarks/' + id, { read: true })).json();
    assert.strictEqual(d.bookmark.read, false);
  } finally { server.close(); }
});

test('SCN-007: deleting removes the bookmark and updates the unread count', async () => {
  const { server, base } = await start();
  try {
    const created = await (await req(base, 'POST', '/api/bookmarks', { url: 'example.com/read', readLater: true })).json();
    const id = created.bookmark.id;
    let snap = await (await req(base, 'GET', '/api/bookmarks')).json();
    assert.strictEqual(snap.unreadCount, 1);

    const del = await req(base, 'DELETE', '/api/bookmarks/' + id);
    assert.strictEqual(del.status, 204);

    snap = await (await req(base, 'GET', '/api/bookmarks')).json();
    assert.strictEqual(snap.total, 0);
    assert.strictEqual(snap.unreadCount, 0);

    const missing = await req(base, 'DELETE', '/api/bookmarks/' + id);
    assert.strictEqual(missing.status, 404);
  } finally { server.close(); }
});
