import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { openDatabase } from '../../src/db.js';
import { BookmarkRepository } from '../../src/repository.js';
import { createApp } from '../../src/server.js';

let server;
let baseUrl;
let db;
let tmpDir;

before(async () => {
  tmpDir = mkdtempSync(join(tmpdir(), 'bm-test-'));
  db = openDatabase(join(tmpDir, 'test.db'));
  const app = createApp(new BookmarkRepository(db));
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', resolve);
  });
  const { port } = server.address();
  baseUrl = `http://127.0.0.1:${port}`;
});

after(() => {
  server?.close();
  db?.close();
  rmSync(tmpDir, { recursive: true, force: true });
});

beforeEach(() => {
  db.exec('DELETE FROM bookmark_tags; DELETE FROM bookmarks; DELETE FROM tags;');
});

async function post(body) {
  return fetch(`${baseUrl}/api/bookmarks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// --- US1: create ------------------------------------------------------------

test('POST creates a bookmark, normalizing a scheme-less url', async () => {
  const res = await post({ url: 'example.com', title: 'Example', notes: 'hi', tags: ['work'] });
  assert.equal(res.status, 201);
  const { bookmark, duplicate } = await res.json();
  assert.equal(bookmark.url, 'https://example.com/');
  assert.equal(bookmark.title, 'Example');
  assert.equal(bookmark.notes, 'hi');
  assert.deepEqual(bookmark.tags, ['work']);
  assert.equal(duplicate, false);
  assert.ok(bookmark.created_at);
});

test('POST rejects an invalid url with 400 and a message', async () => {
  const res = await post({ url: 'not a url' });
  assert.equal(res.status, 400);
  const { error } = await res.json();
  assert.match(error, /valid web address/i);
});

test('POST flags a duplicate url but still creates it', async () => {
  await post({ url: 'https://dup.com/' });
  const res = await post({ url: 'https://dup.com/' });
  assert.equal(res.status, 201);
  const { duplicate } = await res.json();
  assert.equal(duplicate, true);
  const list = await (await fetch(`${baseUrl}/api/bookmarks`)).json();
  assert.equal(list.bookmarks.length, 2);
});

// --- US2: list + search -----------------------------------------------------

test('GET lists newest-first and filters by keyword across fields', async () => {
  await post({ url: 'https://alpha.com/', title: 'Alpha', notes: 'first' });
  await post({ url: 'https://beta.com/', title: 'Beta', notes: 'second special' });

  const all = await (await fetch(`${baseUrl}/api/bookmarks`)).json();
  assert.equal(all.bookmarks.length, 2);
  assert.equal(all.bookmarks[0].title, 'Beta'); // newest first

  const byTitle = await (await fetch(`${baseUrl}/api/bookmarks?q=alpha`)).json();
  assert.equal(byTitle.bookmarks.length, 1);

  const byNotes = await (await fetch(`${baseUrl}/api/bookmarks?q=special`)).json();
  assert.equal(byNotes.bookmarks.length, 1);
  assert.equal(byNotes.bookmarks[0].title, 'Beta');

  const none = await (await fetch(`${baseUrl}/api/bookmarks?q=zzz`)).json();
  assert.deepEqual(none.bookmarks, []);
});

// --- US3: update + delete ---------------------------------------------------

test('PUT updates fields; 404 for missing; 400 for bad url', async () => {
  const created = await (await post({ url: 'https://old.com/', title: 'Old' })).json();
  const id = created.bookmark.id;

  const res = await fetch(`${baseUrl}/api/bookmarks/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'New', tags: ['reading'] }),
  });
  assert.equal(res.status, 200);
  const { bookmark } = await res.json();
  assert.equal(bookmark.title, 'New');
  assert.deepEqual(bookmark.tags, ['reading']);

  const missing = await fetch(`${baseUrl}/api/bookmarks/99999`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'x' }),
  });
  assert.equal(missing.status, 404);

  const badUrl = await fetch(`${baseUrl}/api/bookmarks/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: 'nope' }),
  });
  assert.equal(badUrl.status, 400);
});

test('DELETE removes a bookmark and its tag links; 404 when missing', async () => {
  const created = await (await post({ url: 'https://del.com/', tags: ['temp'] })).json();
  const id = created.bookmark.id;

  const res = await fetch(`${baseUrl}/api/bookmarks/${id}`, { method: 'DELETE' });
  assert.equal(res.status, 204);

  const list = await (await fetch(`${baseUrl}/api/bookmarks`)).json();
  assert.equal(list.bookmarks.length, 0);

  // Cascade: no orphan links remain.
  const links = db.prepare('SELECT COUNT(*) AS n FROM bookmark_tags').get().n;
  assert.equal(links, 0);

  const again = await fetch(`${baseUrl}/api/bookmarks/${id}`, { method: 'DELETE' });
  assert.equal(again.status, 404);
});

// --- US4: tags --------------------------------------------------------------

test('tag filter returns only bookmarks with that tag; GET /api/tags lists in-use tags', async () => {
  await post({ url: 'https://a.com/', tags: ['work', 'reading'] });
  await post({ url: 'https://b.com/', tags: ['work'] });
  await post({ url: 'https://c.com/', tags: ['personal'] });

  const work = await (await fetch(`${baseUrl}/api/bookmarks?tag=work`)).json();
  assert.equal(work.bookmarks.length, 2);

  const tags = await (await fetch(`${baseUrl}/api/tags`)).json();
  assert.deepEqual(tags.tags, ['personal', 'reading', 'work']);
});
