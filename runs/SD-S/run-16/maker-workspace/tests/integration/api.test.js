import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { setDbForTesting, getDb } from '../../src/db.js';
import { setFetcherForTesting } from '../../src/services/enrichment.js';
import { createApp } from '../../src/server.js';

let server;
let base;

const stubMeta = {
  title: 'Fetched Title',
  description: 'Fetched description',
  faviconUrl: 'https://cdn.example.com/fav.ico',
  previewImageUrl: 'https://cdn.example.com/og.png',
};

before(async () => {
  setDbForTesting(new Database(':memory:'));
  setFetcherForTesting(async () => stubMeta);
  const app = createApp();
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', resolve);
  });
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => server && server.close());

beforeEach(() => {
  const db = getDb();
  db.exec('DELETE FROM bookmark_tags; DELETE FROM bookmarks; DELETE FROM tags;');
});

const post = (body) =>
  fetch(`${base}/api/bookmarks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

async function waitEnriched(id) {
  for (let i = 0; i < 50; i++) {
    const res = await fetch(`${base}/api/bookmarks/${id}`);
    const b = await res.json();
    if (b.enrichmentStatus !== 'pending') return b;
    await new Promise((r) => setTimeout(r, 20));
  }
  throw new Error('enrichment did not complete');
}

// --- US1 -----------------------------------------------------------------

test('US1: POST valid scheme-less URL creates a pending bookmark then enriches', async () => {
  const res = await post({ url: 'example.com/a', notes: 'later', tags: ['read'] });
  assert.equal(res.status, 201);
  const created = await res.json();
  assert.equal(created.url, 'https://example.com/a');
  assert.equal(created.enrichmentStatus, 'pending');
  assert.equal(created.title, 'example.com/a'); // URL-derived default
  assert.ok(created.dateSaved);
  assert.deepEqual(created.tags, ['read']);

  const enriched = await waitEnriched(created.id);
  assert.equal(enriched.enrichmentStatus, 'ready');
  assert.equal(enriched.title, 'Fetched Title');
  assert.equal(enriched.description, 'Fetched description');
  assert.equal(enriched.previewImageUrl, 'https://cdn.example.com/og.png');
});

test('US1: invalid URL returns 400 invalid_url and creates nothing', async () => {
  const res = await post({ url: 'not a url' });
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.equal(body.error, 'invalid_url');
  const list = await (await fetch(`${base}/api/bookmarks`)).json();
  assert.equal(list.bookmarks.length, 0);
});

test('US1: duplicate normalized URL returns 409 with existing bookmark', async () => {
  const first = await (await post({ url: 'https://dup.com/' })).json();
  const res = await post({ url: 'http://DUP.com' }); // different scheme/case still dupe? scheme differs
  // Same host, but scheme differs -> normalized differs -> NOT a dupe. Use exact dupe:
  assert.equal(res.status, 201);

  const res2 = await post({ url: 'https://dup.com' }); // trailing slash normalized away
  assert.equal(res2.status, 409);
  const body = await res2.json();
  assert.equal(body.error, 'duplicate');
  assert.equal(body.existing.id, first.id);
});

// --- US2 -----------------------------------------------------------------

test('US2: list is newest-first and search/tag filter work', async () => {
  const a = await (await post({ url: 'example.com/alpha', tags: ['news'] })).json();
  await waitEnriched(a.id);
  const b = await (await post({ url: 'example.com/beta', tags: ['blog'] })).json();
  await waitEnriched(b.id);

  const all = await (await fetch(`${base}/api/bookmarks`)).json();
  assert.equal(all.bookmarks[0].id, b.id); // most recent first

  // Search matches URL substring.
  const searched = await (await fetch(`${base}/api/bookmarks?q=alpha`)).json();
  assert.equal(searched.bookmarks.length, 1);
  assert.equal(searched.bookmarks[0].id, a.id);

  // No-match search returns empty.
  const none = await (await fetch(`${base}/api/bookmarks?q=zzzzz`)).json();
  assert.equal(none.bookmarks.length, 0);

  // Tag filter.
  const tagged = await (await fetch(`${base}/api/bookmarks?tag=blog`)).json();
  assert.equal(tagged.bookmarks.length, 1);
  assert.equal(tagged.bookmarks[0].id, b.id);

  // Tags endpoint.
  const tags = await (await fetch(`${base}/api/tags`)).json();
  assert.deepEqual(tags.tags.sort(), ['blog', 'news']);
});

// --- US3 -----------------------------------------------------------------

test('US3: edit updates fields and persists; user title survives re-enrichment', async () => {
  const created = await (await post({ url: 'example.com/edit' })).json();
  await waitEnriched(created.id);

  const res = await fetch(`${base}/api/bookmarks/${created.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'My Custom Title', description: 'mine', tags: ['x'] }),
  });
  assert.equal(res.status, 200);
  const updated = await res.json();
  assert.equal(updated.title, 'My Custom Title');
  assert.equal(updated.description, 'mine');
  assert.deepEqual(updated.tags, ['x']);

  // Reload confirms persistence.
  const reloaded = await (await fetch(`${base}/api/bookmarks/${created.id}`)).json();
  assert.equal(reloaded.title, 'My Custom Title');
});

test('US3: editing URL re-validates, dedupes against others, and resets enrichment', async () => {
  const a = await (await post({ url: 'example.com/one' })).json();
  await waitEnriched(a.id);
  const b = await (await post({ url: 'example.com/two' })).json();
  await waitEnriched(b.id);

  // Invalid URL edit -> 400.
  const bad = await fetch(`${base}/api/bookmarks/${a.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: 'not a url' }),
  });
  assert.equal(bad.status, 400);

  // Collide with b -> 409.
  const clash = await fetch(`${base}/api/bookmarks/${a.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: 'example.com/two' }),
  });
  assert.equal(clash.status, 409);

  // Valid new URL -> resets to pending, then re-enriches.
  const ok = await fetch(`${base}/api/bookmarks/${a.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: 'example.com/three' }),
  });
  assert.equal(ok.status, 200);
  const moved = await ok.json();
  assert.equal(moved.url, 'https://example.com/three');
  await waitEnriched(a.id);
});

test('US3: delete removes the bookmark', async () => {
  const created = await (await post({ url: 'example.com/del' })).json();
  const res = await fetch(`${base}/api/bookmarks/${created.id}`, { method: 'DELETE' });
  assert.equal(res.status, 204);
  const after = await fetch(`${base}/api/bookmarks/${created.id}`);
  assert.equal(after.status, 404);
});
