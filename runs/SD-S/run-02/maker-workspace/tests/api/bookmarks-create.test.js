import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startTestApp, req, waitForEnrichment } from './helpers.js';

test('create returns 201 with pending status and enriches afterward', async (t) => {
  const app = await startTestApp();
  t.after(() => app.close());

  const { status, body } = await req(app.base, '/api/bookmarks', {
    method: 'POST',
    body: JSON.stringify({ url: 'https://example.com/article' }),
  });
  assert.equal(status, 201);
  assert.equal(body.url, 'https://example.com/article');
  assert.equal(body.enrichmentStatus, 'pending');

  const enriched = await waitForEnrichment(app.base, body.id);
  assert.equal(enriched.enrichmentStatus, 'done');
  assert.equal(enriched.title, 'Stub Title');
  assert.equal(enriched.previewUrl, 'https://x/p.png');
});

test('invalid url is rejected with 400 and creates nothing', async (t) => {
  const app = await startTestApp();
  t.after(() => app.close());

  const { status, body } = await req(app.base, '/api/bookmarks', {
    method: 'POST',
    body: JSON.stringify({ url: 'not-a-url' }),
  });
  assert.equal(status, 400);
  assert.equal(body.error.code, 'invalid_url');

  const list = await req(app.base, '/api/bookmarks');
  assert.equal(list.body.bookmarks.length, 0);
});

test('failed enrichment still keeps the saved bookmark', async (t) => {
  const app = await startTestApp({ enrich: async () => ({ ok: false }) });
  t.after(() => app.close());

  const { body } = await req(app.base, '/api/bookmarks', {
    method: 'POST',
    body: JSON.stringify({ url: 'https://unreachable.example', title: 'My Title' }),
  });
  const enriched = await waitForEnrichment(app.base, body.id);
  assert.equal(enriched.enrichmentStatus, 'failed');
  assert.equal(enriched.title, 'My Title'); // user title preserved
});

test('duplicate url returns 409 with the existing bookmark', async (t) => {
  const app = await startTestApp();
  t.after(() => app.close());

  const first = await req(app.base, '/api/bookmarks', {
    method: 'POST',
    body: JSON.stringify({ url: 'https://dup.example/' }),
  });
  const dup = await req(app.base, '/api/bookmarks', {
    method: 'POST',
    body: JSON.stringify({ url: 'https://dup.example' }), // normalizes to same
  });
  assert.equal(dup.status, 409);
  assert.equal(dup.body.error.code, 'duplicate');
  assert.equal(dup.body.existing.id, first.body.id);
});
