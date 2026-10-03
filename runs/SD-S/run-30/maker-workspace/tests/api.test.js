import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// Use an isolated in-memory database and prevent the app from auto-listening.
process.env.NODE_ENV = 'test';
process.env.BOOKMARKS_DB_PATH = ':memory:';

const { default: app } = await import('../server/index.js');
const { default: db } = await import('../server/db.js');

let server;
let base;

before(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', resolve);
  });
  const { port } = server.address();
  base = `http://127.0.0.1:${port}`;
});

after(() => {
  server?.close();
});

beforeEach(() => {
  db.exec('DELETE FROM bookmark_tags; DELETE FROM tags; DELETE FROM bookmarks;');
});

function post(path, body) {
  return fetch(base + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}
function put(path, body) {
  return fetch(base + path, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// --- US1: Save -------------------------------------------------------------

test('POST creates a bookmark with a provided title', async () => {
  const res = await post('/api/bookmarks', { url: 'https://example.com/a', title: 'Example A' });
  assert.equal(res.status, 201);
  const b = await res.json();
  assert.equal(b.url, 'https://example.com/a');
  assert.equal(b.title, 'Example A');
  assert.ok(b.id);
  assert.deepEqual(b.tags, []);
});

test('POST rejects an invalid URL with 400', async () => {
  const res = await post('/api/bookmarks', { url: 'not a url' });
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.match(body.error, /valid/i);
});

test('POST rejects a non-http scheme with 400', async () => {
  const res = await post('/api/bookmarks', { url: 'ftp://example.com/file' });
  assert.equal(res.status, 400);
});

test('POST detects a duplicate (normalized) URL with 409', async () => {
  const first = await (await post('/api/bookmarks', { url: 'https://Example.com/a/', title: 'A' })).json();
  const res = await post('/api/bookmarks', { url: 'https://example.com/a', title: 'dup' });
  assert.equal(res.status, 409);
  const body = await res.json();
  assert.equal(body.existingId, first.id);
});

// --- US2: Browse / search --------------------------------------------------

test('GET lists bookmarks newest first', async () => {
  await post('/api/bookmarks', { url: 'https://example.com/one', title: 'One' });
  await post('/api/bookmarks', { url: 'https://example.com/two', title: 'Two' });
  const list = (await (await fetch(base + '/api/bookmarks')).json()).bookmarks;
  assert.equal(list.length, 2);
  assert.equal(list[0].title, 'Two'); // most recent first
});

test('GET search matches title, url, and note case-insensitively', async () => {
  await post('/api/bookmarks', { url: 'https://example.com/js', title: 'JavaScript Guide' });
  await post('/api/bookmarks', { url: 'https://example.com/py', title: 'Python', note: 'about javascript too' });
  await post('/api/bookmarks', { url: 'https://example.com/rust', title: 'Rust' });

  const byTitle = (await (await fetch(base + '/api/bookmarks?search=javascript')).json()).bookmarks;
  assert.equal(byTitle.length, 2); // title match + note match

  const none = (await (await fetch(base + '/api/bookmarks?search=nomatchxyz')).json()).bookmarks;
  assert.deepEqual(none, []);
});

// --- US3: Tags & notes -----------------------------------------------------

test('POST stores tags and note; GET /api/tags returns distinct names', async () => {
  await post('/api/bookmarks', { url: 'https://example.com/a', title: 'A', tags: ['tech', 'Reading'], note: 'hi' });
  await post('/api/bookmarks', { url: 'https://example.com/b', title: 'B', tags: ['tech'] });

  const a = (await (await fetch(base + '/api/bookmarks')).json()).bookmarks.find((x) => x.title === 'A');
  assert.deepEqual([...a.tags].sort(), ['Reading', 'tech']);
  assert.equal(a.note, 'hi');

  const tags = (await (await fetch(base + '/api/tags')).json()).tags;
  assert.deepEqual([...tags].sort((x, y) => x.localeCompare(y)), ['Reading', 'tech']);
});

test('GET filters by tag and combines with search', async () => {
  await post('/api/bookmarks', { url: 'https://example.com/a', title: 'Alpha', tags: ['work'] });
  await post('/api/bookmarks', { url: 'https://example.com/b', title: 'Beta', tags: ['home'] });

  const work = (await (await fetch(base + '/api/bookmarks?tag=work')).json()).bookmarks;
  assert.equal(work.length, 1);
  assert.equal(work[0].title, 'Alpha');

  const combo = (await (await fetch(base + '/api/bookmarks?tag=work&search=beta')).json()).bookmarks;
  assert.deepEqual(combo, []);
});

// --- US4: Edit & delete ----------------------------------------------------

test('PUT updates fields and refreshes updatedAt', async () => {
  const b = await (await post('/api/bookmarks', { url: 'https://example.com/a', title: 'Old', tags: ['x'] })).json();
  const res = await put(`/api/bookmarks/${b.id}`, { url: 'https://example.com/a', title: 'New', tags: ['y', 'z'], note: 'n' });
  assert.equal(res.status, 200);
  const updated = await res.json();
  assert.equal(updated.title, 'New');
  assert.deepEqual([...updated.tags].sort(), ['y', 'z']);
  assert.equal(updated.note, 'n');
  assert.notEqual(updated.updatedAt, b.updatedAt);
});

test('PUT returns 404 for unknown id and 409 on duplicate url', async () => {
  const a = await (await post('/api/bookmarks', { url: 'https://example.com/a', title: 'A' })).json();
  await post('/api/bookmarks', { url: 'https://example.com/b', title: 'B' });

  const missing = await put('/api/bookmarks/99999', { url: 'https://example.com/x' });
  assert.equal(missing.status, 404);

  const clash = await put(`/api/bookmarks/${a.id}`, { url: 'https://example.com/b' });
  assert.equal(clash.status, 409);
});

test('DELETE removes a bookmark and 404s for unknown id', async () => {
  const b = await (await post('/api/bookmarks', { url: 'https://example.com/a', title: 'A' })).json();
  const del = await fetch(`${base}/api/bookmarks/${b.id}`, { method: 'DELETE' });
  assert.equal(del.status, 204);

  const list = (await (await fetch(base + '/api/bookmarks')).json()).bookmarks;
  assert.equal(list.length, 0);

  const again = await fetch(`${base}/api/bookmarks/${b.id}`, { method: 'DELETE' });
  assert.equal(again.status, 404);
});
