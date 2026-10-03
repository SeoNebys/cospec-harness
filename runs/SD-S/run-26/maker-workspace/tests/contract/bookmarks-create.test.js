import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startApp, startFixtureServer, jsonFetch } from './helpers.js';

let app, fixture;

before(async () => {
  fixture = await startFixtureServer();
  app = await startApp();
});
after(async () => {
  await app.close();
  await new Promise((r) => fixture.server.close(r));
});

test('POST rejects an invalid address with 400 and saves nothing (FR-002)', async () => {
  const { status, body } = await jsonFetch(`${app.base}/api/bookmarks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address: 'not a url' }),
  });
  assert.equal(status, 400);
  assert.ok(body.error);
  const list = await jsonFetch(`${app.base}/api/bookmarks`);
  assert.equal(list.body.count, 0);
});

test('POST a web page creates a bookmark with auto details + snapshot (US1/US2)', async () => {
  const { status, body } = await jsonFetch(`${app.base}/api/bookmarks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address: `${fixture.base}/page`, tags: ['reading'] }),
  });
  assert.equal(status, 201);
  assert.equal(body.title, 'Fixture OG Title');
  assert.equal(body.description, 'OG fixture description.');
  assert.equal(body.status, 'unread');
  assert.deepEqual(body.tags, ['reading']);
  assert.equal(body.snapshotAvailable, true);
  assert.equal(body.snapshotType, 'webpage');

  // Snapshot is served with the MHTML content type (FR-006).
  const snap = await fetch(`${app.base}${body.snapshotUrl}`);
  assert.equal(snap.status, 200);
  assert.match(snap.headers.get('content-type'), /multipart\/related/);
});

test('PATCH edits title/description and persists (FR-004)', async () => {
  const created = await jsonFetch(`${app.base}/api/bookmarks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address: `${fixture.base}/page?x=edit` }),
  });
  const id = created.body.id;
  const { status, body } = await jsonFetch(`${app.base}/api/bookmarks/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'My Title', description: 'My desc' }),
  });
  assert.equal(status, 200);
  assert.equal(body.title, 'My Title');
  assert.equal(body.description, 'My desc');

  const reread = await jsonFetch(`${app.base}/api/bookmarks/${id}`);
  assert.equal(reread.body.title, 'My Title');
});

test('POST a PDF preserves it as a PDF snapshot (FR-007)', async () => {
  const { status, body } = await jsonFetch(`${app.base}/api/bookmarks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address: `${fixture.base}/doc.pdf` }),
  });
  assert.equal(status, 201);
  assert.equal(body.snapshotAvailable, true);
  assert.equal(body.snapshotType, 'pdf');
  const snap = await fetch(`${app.base}${body.snapshotUrl}`);
  assert.equal(snap.status, 200);
  assert.match(snap.headers.get('content-type'), /application\/pdf/);
});

test('POST a duplicate address returns the existing bookmark for editing (FR-018)', async () => {
  const addr = `${fixture.base}/page?x=dup`;
  const first = await jsonFetch(`${app.base}/api/bookmarks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address: addr }),
  });
  assert.equal(first.status, 201);
  const dup = await jsonFetch(`${app.base}/api/bookmarks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address: `${addr}#frag` }),
  });
  assert.equal(dup.status, 200);
  assert.equal(dup.body.duplicate, true);
  assert.equal(dup.body.bookmark.id, first.body.id);
});
