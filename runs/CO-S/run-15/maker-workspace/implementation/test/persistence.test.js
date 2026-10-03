'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createApp } = require('../src/server');
const { createStore } = require('../src/store');

const stubFetchTitle = async () => ({ ok: true, title: 'Persisted' });

function startWith(store) {
  const app = createApp({ store, fetchTitle: stubFetchTitle });
  return new Promise((resolve) => {
    const server = app.listen(0, '127.0.0.1', () => {
      resolve({ server, base: 'http://127.0.0.1:' + server.address().port });
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

test('SCN-008: bookmarks (title, tags, read-later) survive a restart', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bm-'));
  const file = path.join(dir, 'bookmarks.json');
  const store1 = createStore(file);

  // First "session": save and tag a read-later bookmark.
  let s = await startWith(store1);
  try {
    const created = await (await req(s.base, 'POST', '/api/bookmarks', { url: 'example.com/a', readLater: true })).json();
    const id = created.bookmark.id;
    await req(s.base, 'PATCH', '/api/bookmarks/' + id, { tags: ['keep'], title: 'Kept name' });
  } finally { s.server.close(); }

  // Second "session": a brand-new store instance reading the same file.
  const store2 = createStore(file);
  s = await startWith(store2);
  try {
    const snap = await (await req(s.base, 'GET', '/api/bookmarks')).json();
    assert.strictEqual(snap.total, 1);
    assert.strictEqual(snap.bookmarks[0].title, 'Kept name');
    assert.deepStrictEqual(snap.bookmarks[0].tags, ['keep']);
    assert.strictEqual(snap.bookmarks[0].readLater, true);
    assert.strictEqual(snap.unreadCount, 1);
  } finally { s.server.close(); }

  fs.rmSync(dir, { recursive: true, force: true });
});
