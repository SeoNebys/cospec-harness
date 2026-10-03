// Gherkin-based acceptance tests exercised through the HTTP API.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { Store } from '../store.js';
import { createApp } from '../server.js';

let server, base, dataFile, store;

// A deterministic stand-in for the real title fetcher (no network in tests).
const fakeTitle = async (url) => 'Title of ' + url;

before(async () => {
  dataFile = join(tmpdir(), 'bm-api-' + randomUUID() + '.json');
  store = new Store(dataFile);
  const app = createApp({ store, titleFetcher: fakeTitle });
  await new Promise((res) => { server = app.listen(0, res); });
  base = 'http://127.0.0.1:' + server.address().port;
});
after(() => { server.close(); rmSync(dataFile, { force: true }); });

const post = (body) => fetch(base + '/api/bookmarks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const patch = (id, body) => fetch(base + '/api/bookmarks/' + id, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const del = (id) => fetch(base + '/api/bookmarks/' + id, { method: 'DELETE' });
const listAll = async () => (await fetch(base + '/api/bookmarks')).json();

test('SCN-001: save a link → 201, real title filled in, appears at top', async () => {
  const r1 = await post({ url: 'https://en.wikipedia.org/wiki/Bookmark', tags: ['reading'] });
  assert.equal(r1.status, 201);
  const b1 = await r1.json();
  assert.equal(b1.title, 'Title of https://en.wikipedia.org/wiki/Bookmark');
  assert.deepEqual(b1.tags, ['reading']);

  const r2 = await post({ url: 'https://developer.mozilla.org', tags: [] });
  const b2 = await r2.json();
  const all = await listAll();
  assert.equal(all[0].id, b2.id, 'newest is first');
  assert.equal(all.length, 2);
});

test('SCN-008: an empty or invalid address is rejected', async () => {
  assert.equal((await post({ url: '' })).status, 400);
  assert.equal((await post({ url: 'not a url' })).status, 400);
});

test('SCN-008: an address without a scheme is accepted and normalized', async () => {
  const r = await post({ url: 'example.com/article' });
  assert.equal(r.status, 201);
  const b = await r.json();
  assert.equal(b.url, 'https://example.com/article');
});

test('SCN-008: duplicates are blocked and the existing bookmark returned', async () => {
  await post({ url: 'https://github.com' });
  const dup = await post({ url: 'https://www.github.com/' }); // www + trailing slash
  assert.equal(dup.status, 409);
  const body = await dup.json();
  assert.equal(body.error, 'duplicate');
  assert.equal(body.bookmark.url, 'https://github.com');
});

test('SCN-008 + SCN-006: an archived duplicate is surfaced as archived', async () => {
  const created = await (await post({ url: 'https://archived-example.org' })).json();
  await patch(created.id, { archived: true });
  const dup = await post({ url: 'https://archived-example.org' });
  assert.equal(dup.status, 409);
  const body = await dup.json();
  assert.equal(body.bookmark.archived, true);
});

test('SCN-002: edit title and tags; empty title keeps previous', async () => {
  const b = await (await post({ url: 'https://edit-me.com', tags: ['old'] })).json();
  const u1 = await (await patch(b.id, { title: 'My Title', tags: ['New', 'new', 'ref'] })).json();
  assert.equal(u1.title, 'My Title');
  assert.deepEqual(u1.tags, ['new', 'ref']);
  const u2 = await (await patch(b.id, { title: '  ' })).json();
  assert.equal(u2.title, 'My Title', 'empty title keeps previous');
});

test('SCN-005: read-later toggle on and off', async () => {
  const b = await (await post({ url: 'https://read-later.com' })).json();
  assert.equal((await (await patch(b.id, { toRead: true })).json()).toRead, true);
  assert.equal((await (await patch(b.id, { toRead: false })).json()).toRead, false);
});

test('SCN-006: archive and restore', async () => {
  const b = await (await post({ url: 'https://archive-flow.com' })).json();
  assert.equal((await (await patch(b.id, { archived: true })).json()).archived, true);
  assert.equal((await (await patch(b.id, { archived: false })).json()).archived, false);
});

test('SCN-007: delete permanently; unknown id → 404', async () => {
  const b = await (await post({ url: 'https://delete-me.com' })).json();
  assert.equal((await del(b.id)).status, 204);
  const all = await listAll();
  assert.ok(!all.find((x) => x.id === b.id));
  assert.equal((await del(b.id)).status, 404);
});

test('SCN-009: save still succeeds when the title cannot be read (address used)', async () => {
  const dataFile2 = join(tmpdir(), 'bm-api-fail-' + randomUUID() + '.json');
  const store2 = new Store(dataFile2);
  const app2 = createApp({ store: store2, titleFetcher: async (url) => url }); // simulates fallback
  const srv2 = await new Promise((res) => { const s = app2.listen(0, () => res(s)); });
  try {
    const b = await (await fetch('http://127.0.0.1:' + srv2.address().port + '/api/bookmarks', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: 'https://unreachable.example' }),
    })).json();
    assert.equal(b.title, 'https://unreachable.example');
  } finally { srv2.close(); rmSync(dataFile2, { force: true }); }
});

test('SCN-010: data written through the API persists to disk', async () => {
  await post({ url: 'https://persist-check.com', tags: ['persist'] });
  const reloaded = new Store(dataFile); // fresh instance reads the same file
  assert.ok(reloaded.all().find((b) => b.url === 'https://persist-check.com'));
});
