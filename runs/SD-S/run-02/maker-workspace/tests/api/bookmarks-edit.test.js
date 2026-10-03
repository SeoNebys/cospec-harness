import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startTestApp, req, waitForEnrichment } from './helpers.js';

async function createOne(base, overrides = {}) {
  const { body } = await req(base, '/api/bookmarks', {
    method: 'POST',
    body: JSON.stringify({ url: 'https://edit.example', ...overrides }),
  });
  return body;
}

test('PATCH updates fields and persists', async (t) => {
  const app = await startTestApp();
  t.after(() => app.close());
  const b = await createOne(app.base);

  const { status, body } = await req(app.base, `/api/bookmarks/${b.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ title: 'Edited', note: 'A note', tags: ['x', 'y'] }),
  });
  assert.equal(status, 200);
  assert.equal(body.title, 'Edited');
  assert.equal(body.note, 'A note');
  assert.deepEqual(body.tags, ['x', 'y']);

  const again = await req(app.base, `/api/bookmarks/${b.id}`);
  assert.equal(again.body.title, 'Edited');
});

test('manual edits survive an enrichment refresh', async (t) => {
  const app = await startTestApp();
  t.after(() => app.close());
  const b = await createOne(app.base);
  await waitForEnrichment(app.base, b.id);

  await req(app.base, `/api/bookmarks/${b.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ title: 'Locked Title' }),
  });
  const refresh = await req(app.base, `/api/bookmarks/${b.id}/refresh`, { method: 'POST' });
  assert.equal(refresh.status, 202);
  const after2 = await waitForEnrichment(app.base, b.id);
  assert.equal(after2.title, 'Locked Title'); // not overwritten by stub enrichment
});

test('changing URL to an existing one returns 409', async (t) => {
  const app = await startTestApp();
  t.after(() => app.close());
  const a = await createOne(app.base, { url: 'https://one.example' });
  const b = await req(app.base, '/api/bookmarks', {
    method: 'POST',
    body: JSON.stringify({ url: 'https://two.example' }),
  });

  const { status, body } = await req(app.base, `/api/bookmarks/${b.body.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ url: 'https://one.example' }),
  });
  assert.equal(status, 409);
  assert.equal(body.existing.id, a.id);
});

test('DELETE removes the bookmark', async (t) => {
  const app = await startTestApp();
  t.after(() => app.close());
  const b = await createOne(app.base);

  const del = await req(app.base, `/api/bookmarks/${b.id}`, { method: 'DELETE' });
  assert.equal(del.status, 204);
  const gone = await req(app.base, `/api/bookmarks/${b.id}`);
  assert.equal(gone.status, 404);
});
