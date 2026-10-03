import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { createApp } from '../app.js';

async function fixture(t) {
  const metadataProvider = async url => ({
    title: url.includes('potato') ? 'Crispy potatoes' : 'Useful page',
    description: 'A description collected from the page.',
    siteName: new URL(url).hostname,
    faviconUrl: null,
    fallback: false
  });
  const { app, store } = createApp({ dbFile: ':memory:', metadataProvider });
  const server = createServer(app);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  t.after(async () => {
    server.close();
    await once(server, 'close');
    store.close();
  });
  return { base };
}

async function request(base, path, options = {}) {
  const response = await fetch(`${base}${path}`, {
    ...options,
    headers: { 'content-type': 'application/json', ...(options.headers || {}) }
  });
  const body = response.status === 204 ? null : await response.json();
  return { response, body };
}

test('prepare, save, duplicate recognition, and archived duplicate behavior share one record', async t => {
  const { base } = await fixture(t);
  const url = 'https://example.com/potato';
  const prepared = await request(base, '/api/bookmarks/prepare', { method: 'POST', body: JSON.stringify({ url }) });
  assert.equal(prepared.body.status, 'new');

  const created = await request(base, '/api/bookmarks', {
    method: 'POST',
    body: JSON.stringify({ ...prepared.body.draft, title: 'My potatoes', labels: ['Recipes'], readLater: true })
  });
  assert.equal(created.response.status, 201);
  const id = created.body.bookmark.id;

  await request(base, `/api/bookmarks/${id}`, { method: 'PATCH', body: JSON.stringify({ archived: true }) });
  const duplicate = await request(base, '/api/bookmarks/prepare', {
    method: 'POST',
    body: JSON.stringify({ url: `${url}?utm_campaign=mail#notes` })
  });
  assert.equal(duplicate.body.status, 'existing');
  assert.equal(duplicate.body.bookmark.id, id);
  assert.equal(duplicate.body.bookmark.archived, true);
  assert.equal(duplicate.body.bookmark.readLater, true);
  assert.deepEqual(duplicate.body.bookmark.labels, ['Recipes']);
});

test('live collection queries combine case-insensitive search, label, and reading filters', async t => {
  const { base } = await fixture(t);
  for (const input of [
    { url: 'https://example.com/potato', title: 'Roast potatoes', description: 'Fluffy centers', labels: ['Recipes'], readLater: true },
    { url: 'https://example.com/design', title: 'Color systems', description: 'Accessible palettes', labels: ['Work'], readLater: false }
  ]) {
    await request(base, '/api/bookmarks', {
      method: 'POST',
      body: JSON.stringify({ siteName: 'Example', faviconUrl: null, ...input })
    });
  }
  const result = await request(base, '/api/bookmarks?view=later&search=FLUFFY&label=recipes');
  assert.equal(result.body.count, 1);
  assert.equal(result.body.items[0].title, 'Roast potatoes');
});

test('invalid addresses are rejected rather than guessed', async t => {
  const { base } = await fixture(t);
  const result = await request(base, '/api/bookmarks/prepare', {
    method: 'POST',
    body: JSON.stringify({ url: 'example.com/page' })
  });
  assert.equal(result.response.status, 400);
  assert.match(result.body.error, /http:\/\//);
});

