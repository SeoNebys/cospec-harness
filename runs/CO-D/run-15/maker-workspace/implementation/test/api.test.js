import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from '../server.js';

const fixtureFile = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'metadata.json');

async function withServer(callback, options = {}) {
  const app = createApp({
    databasePath: ':memory:',
    email: 'owner@example.com',
    password: 'secret',
    metadataFixtureFile: fixtureFile,
    ...options
  });
  await new Promise((resolve) => app.server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${app.server.address().port}`;
  try { await callback({ app, base }); } finally { await app.close(); }
}

async function login(base, password = 'secret') {
  const response = await fetch(`${base}/api/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'owner@example.com', password })
  });
  return { response, cookie: response.headers.get('set-cookie')?.split(';')[0] };
}

function client(base, cookie) {
  return async (pathname, options = {}) => {
    const response = await fetch(`${base}${pathname}`, {
      ...options,
      headers: { cookie, ...(options.body ? { 'content-type': 'application/json' } : {}), ...options.headers }
    });
    return { response, body: await response.json() };
  };
}

test('SCN-001, SCN-002, SCN-011, SCN-012, and SCN-013: saving gathers honest metadata and rejects duplicates or invalid input', async () => {
  await withServer(async ({ base }) => {
    const auth = await login(base);
    const request = client(base, auth.cookie);
    const saved = await request('/api/bookmarks', { method: 'POST', body: JSON.stringify({ url: 'https://recipes.example/roman-pasta' }) });
    assert.equal(saved.response.status, 201);
    assert.equal(saved.body.bookmark.title, 'Essential Roman Pasta Recipes');
    assert.equal(saved.body.bookmark.siteName, 'The Kitchen Journal');
    assert.ok(saved.body.bookmark.previewImage);

    const tracked = await request('/api/bookmarks', { method: 'POST', body: JSON.stringify({ url: 'https://recipes.example/roman-pasta?utm_source=newsletter' }) });
    assert.equal(tracked.body.duplicate, true);
    assert.equal(tracked.body.bookmark.id, saved.body.bookmark.id);

    const different = await request('/api/bookmarks', { method: 'POST', body: JSON.stringify({ url: 'https://recipes.example/roman-pasta?serves=8' }) });
    assert.equal(different.response.status, 201);
    assert.notEqual(different.body.bookmark.id, saved.body.bookmark.id);

    const unavailable = await request('/api/bookmarks', { method: 'POST', body: JSON.stringify({ url: 'https://unreadable.invalid/missing-page' }) });
    assert.equal(unavailable.response.status, 201);
    assert.equal(unavailable.body.bookmark.metadataStatus, 'unavailable');
    assert.equal(unavailable.body.bookmark.description, '');
    assert.equal(unavailable.body.bookmark.previewImage, '');

    const invalid = await request('/api/bookmarks', { method: 'POST', body: JSON.stringify({ url: 'some words' }) });
    assert.equal(invalid.response.status, 400);
    assert.match(invalid.body.error, /full web address/i);
    const list = await request('/api/bookmarks');
    assert.equal(list.body.total, 3);
  });
});

test('SCN-008, SCN-009, and SCN-017: edits preserve client organization and different-page refresh is explicit', async () => {
  await withServer(async ({ base }) => {
    const auth = await login(base);
    const request = client(base, auth.cookie);
    const created = (await request('/api/bookmarks', { method: 'POST', body: JSON.stringify({ url: 'https://recipes.example/roman-pasta?utm_source=newsletter' }) })).body.bookmark;
    let item = (await request(`/api/bookmarks/${created.id}/tags`, { method: 'POST', body: JSON.stringify({ name: 'Cooking' }) })).body.bookmark;
    item = (await request(`/api/bookmarks/${created.id}`, { method: 'PATCH', body: JSON.stringify({ noteHtml: '<ul><li><strong>Sunday</strong> dinner</li></ul>', readLater: true }) })).body.bookmark;
    assert.match(item.noteHtml, /<ul>/);

    item = (await request(`/api/bookmarks/${created.id}`, { method: 'PATCH', body: JSON.stringify({ url: 'https://recipes.example/roman-pasta', title: 'Roman Pasta Recipes to Try', description: 'My wording' }) })).body.bookmark;
    assert.equal(item.title, 'Roman Pasta Recipes to Try');
    assert.equal(item.tags[0].name, 'Cooking');
    assert.equal(item.readLater, true);
    assert.match(item.notePlain, /Sunday/);

    const warning = await request(`/api/bookmarks/${created.id}`, { method: 'PATCH', body: JSON.stringify({ url: 'https://travel.example/naples-guide' }) });
    assert.equal(warning.response.status, 409);
    assert.equal(warning.body.code, 'DIFFERENT_PAGE');
    const unchanged = (await request(`/api/bookmarks/${created.id}`)).body.bookmark;
    assert.equal(unchanged.url, 'https://recipes.example/roman-pasta');

    const refreshed = (await request(`/api/bookmarks/${created.id}`, { method: 'PATCH', body: JSON.stringify({ url: 'https://travel.example/naples-guide', detailStrategy: 'refresh' }) })).body.bookmark;
    assert.equal(refreshed.title, 'A Weekend in Naples');
    assert.equal(refreshed.siteName, 'Slow Atlas');
    assert.equal(refreshed.tags[0].name, 'Cooking');
    assert.equal(refreshed.readLater, true);
    assert.match(refreshed.notePlain, /Sunday/);
  });
});

test('SCN-019 and SCN-020: set-aside is reversible while delete is permanent and isolated', async () => {
  await withServer(async ({ base }) => {
    const auth = await login(base);
    const request = client(base, auth.cookie);
    const first = (await request('/api/bookmarks', { method: 'POST', body: JSON.stringify({ url: 'https://recipes.example/roman-pasta' }) })).body.bookmark;
    const second = (await request('/api/bookmarks', { method: 'POST', body: JSON.stringify({ url: 'https://travel.example/rome-guide' }) })).body.bookmark;
    await request(`/api/bookmarks/${first.id}/tags`, { method: 'POST', body: JSON.stringify({ name: 'Travel' }) });
    await request(`/api/bookmarks/${second.id}/tags`, { method: 'POST', body: JSON.stringify({ name: 'Travel' }) });

    await request(`/api/bookmarks/${first.id}`, { method: 'PATCH', body: JSON.stringify({ archived: true, readLater: true, noteHtml: '<b>Keep me</b>' }) });
    assert.equal((await request('/api/bookmarks?view=active&q=Essential')).body.total, 0);
    const aside = (await request('/api/bookmarks?view=aside')).body.items[0];
    assert.equal(aside.readLater, true);
    assert.equal(aside.tags[0].name, 'Travel');
    await request(`/api/bookmarks/${first.id}`, { method: 'PATCH', body: JSON.stringify({ archived: false }) });
    assert.equal((await request('/api/bookmarks?view=active&q=Essential')).body.total, 1);

    assert.equal((await request(`/api/bookmarks/${first.id}`, { method: 'DELETE' })).response.status, 200);
    assert.equal((await request(`/api/bookmarks/${first.id}`)).response.status, 404);
    assert.equal((await request(`/api/bookmarks/${second.id}`)).body.bookmark.title, 'A Quiet Guide to Rome');
    assert.equal((await request('/api/tags?q=Tra')).body.tags[0].name, 'Travel');
  });
});

test('SCN-010, SCN-018, and SCN-022: sign-in is private, errors are generic, and sessions persist until expiry', async () => {
  await withServer(async ({ base }) => {
    const bad = await login(base, 'wrong');
    assert.equal(bad.response.status, 401);
    assert.deepEqual(await bad.response.json(), { error: 'Those details do not match this account.', code: 'INVALID_CREDENTIALS' });

    const auth = await login(base);
    assert.ok(auth.cookie);
    const request = client(base, auth.cookie);
    assert.equal((await request('/api/session')).body.signedIn, true);
    assert.equal((await request('/api/bookmarks')).response.status, 200);
    assert.equal((await fetch(`${base}/api/bookmarks`)).status, 401);
  }, { sessionTtlMs: 60_000 });
});
