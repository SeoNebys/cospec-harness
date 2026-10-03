import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import { createHttpServer } from '../app.mjs';
import { createStore } from '../lib/store.mjs';

let store;
let server;
let baseUrl;
let metadataVersion;

function detailsFor(address) {
  const url = new URL(address);
  if (url.pathname.includes('unavailable')) throw new Error('page unavailable');
  if (url.pathname.includes('knowledge')) {
    return { title: metadataVersion === 1 ? 'A personal knowledge garden' : 'A changed source-page title', description: 'Collect and connect useful ideas.', site: 'articles.example.com' };
  }
  if (url.pathname.includes('course')) return { title: 'Notes from online courses', description: 'A practical method for learning actively.', site: 'notes.example.org' };
  return { title: 'A useful page', description: 'A saved page description.', site: url.hostname };
}

beforeEach(async () => {
  metadataVersion = 1;
  store = createStore();
  server = createHttpServer({ store, metadataLoader: async address => detailsFor(address) });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

afterEach(async () => {
  await new Promise(resolve => server.close(resolve));
  store.close();
});

async function request(path, { method = 'GET', body } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: body === undefined ? {} : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  return { status: response.status, data: await response.json() };
}

async function save(path = '/knowledge') {
  const result = await request('/api/bookmarks', { method: 'POST', body: { url: `https://articles.example.com${path}` } });
  assert.equal(result.status, 201);
  return result.data.bookmark;
}

test('SCN-001 saves a valid address with collected title, description, and site', async () => {
  const bookmark = await save();
  assert.equal(bookmark.title, 'A personal knowledge garden');
  assert.equal(bookmark.description, 'Collect and connect useful ideas.');
  assert.equal(bookmark.site, 'articles.example.com');
  assert.equal((await request('/api/bookmarks?view=all')).data.bookmarks.length, 1);
});

test('SCN-002 adds a visible label to a bookmark', async () => {
  const bookmark = await save();
  const result = await request(`/api/bookmarks/${bookmark.id}/labels`, { method: 'POST', body: { name: 'learning' } });
  assert.equal(result.status, 201);
  assert.deepEqual(result.data.bookmark.labels, ['learning']);
});

test('SCN-003 searches collected details and labels from the same query', async () => {
  const labeled = await save('/knowledge');
  await request(`/api/bookmarks/${labeled.id}/labels`, { method: 'POST', body: { name: 'learning' } });
  await save('/course');
  await save('/cooking');
  const result = await request('/api/bookmarks?view=all&q=learning');
  assert.equal(result.status, 200);
  assert.equal(result.data.bookmarks.length, 2);
  assert.deepEqual(new Set(result.data.bookmarks.map(item => item.title)), new Set(['A personal knowledge garden', 'Notes from online courses']));
});

test('SCN-004 marks a bookmark for later without removing it from all bookmarks', async () => {
  const bookmark = await save();
  await request(`/api/bookmarks/${bookmark.id}`, { method: 'PATCH', body: { readLater: true } });
  assert.equal((await request('/api/bookmarks?view=all')).data.bookmarks.length, 1);
  assert.equal((await request('/api/bookmarks?view=later')).data.bookmarks.length, 1);
});

test('SCN-005 archives a bookmark with details and labels intact', async () => {
  const bookmark = await save();
  await request(`/api/bookmarks/${bookmark.id}/labels`, { method: 'POST', body: { name: 'learning' } });
  await request(`/api/bookmarks/${bookmark.id}`, { method: 'PATCH', body: { archived: true } });
  assert.equal((await request('/api/bookmarks?view=all')).data.bookmarks.length, 0);
  const archived = (await request('/api/bookmarks?view=archive')).data.bookmarks[0];
  assert.equal(archived.title, 'A personal knowledge garden');
  assert.deepEqual(archived.labels, ['learning']);
});

test('SCN-006 keeps a bookmark when details cannot be collected and allows retry', async () => {
  const bookmark = await save('/unavailable');
  assert.equal(bookmark.detailsStatus, 'needs_details');
  assert.match(bookmark.title, /articles\.example\.com\/unavailable/);
  assert.match(bookmark.description, /still saved/);
  const retry = await request(`/api/bookmarks/${bookmark.id}/retry-details`, { method: 'POST', body: {} });
  assert.equal(retry.status, 502);
  assert.equal((await request('/api/bookmarks?view=all')).data.bookmarks.length, 1);
});

test('SCN-007 blocks incomplete addresses without creating a bookmark', async () => {
  const result = await request('/api/bookmarks', { method: 'POST', body: { url: 'interesting article' } });
  assert.equal(result.status, 422);
  assert.match(result.data.error, /complete web address/);
  assert.equal((await request('/api/bookmarks?view=all')).data.bookmarks.length, 0);
});

test('SCN-008 prevents duplicate labels regardless of capitalization', async () => {
  const bookmark = await save();
  await request(`/api/bookmarks/${bookmark.id}/labels`, { method: 'POST', body: { name: 'learning' } });
  const duplicate = await request(`/api/bookmarks/${bookmark.id}/labels`, { method: 'POST', body: { name: 'Learning' } });
  assert.equal(duplicate.status, 409);
  assert.deepEqual(duplicate.data.bookmark.labels, ['learning']);
});

test('SCN-009 returns an empty result set for an unmatched search', async () => {
  await save();
  const result = await request('/api/bookmarks?view=all&q=astronomy');
  assert.equal(result.status, 200);
  assert.deepEqual(result.data.bookmarks, []);
});

test('SCN-010 returns an empty reading pile before anything is marked', async () => {
  await save();
  assert.deepEqual((await request('/api/bookmarks?view=later')).data.bookmarks, []);
});

test('SCN-011 returns an empty archive before anything is archived', async () => {
  await save();
  assert.deepEqual((await request('/api/bookmarks?view=archive')).data.bookmarks, []);
});

test('SCN-012 archiving a read-later bookmark removes it from both active views', async () => {
  const bookmark = await save();
  await request(`/api/bookmarks/${bookmark.id}`, { method: 'PATCH', body: { readLater: true } });
  const result = await request(`/api/bookmarks/${bookmark.id}`, { method: 'PATCH', body: { archived: true } });
  assert.equal(result.data.bookmark.readLater, false);
  assert.equal((await request('/api/bookmarks?view=all')).data.bookmarks.length, 0);
  assert.equal((await request('/api/bookmarks?view=later')).data.bookmarks.length, 0);
  assert.equal((await request('/api/bookmarks?view=archive')).data.bookmarks.length, 1);
});

test('SCN-013 keeps one copy when the same address is saved twice', async () => {
  await save();
  const duplicate = await request('/api/bookmarks', { method: 'POST', body: { url: 'https://articles.example.com/knowledge' } });
  assert.equal(duplicate.status, 409);
  assert.equal((await request('/api/bookmarks?view=all')).data.bookmarks.length, 1);
});

test('SCN-014 removing Read later keeps the bookmark active', async () => {
  const bookmark = await save();
  await request(`/api/bookmarks/${bookmark.id}`, { method: 'PATCH', body: { readLater: true } });
  await request(`/api/bookmarks/${bookmark.id}`, { method: 'PATCH', body: { readLater: false } });
  assert.equal((await request('/api/bookmarks?view=later')).data.bookmarks.length, 0);
  assert.equal((await request('/api/bookmarks?view=all')).data.bookmarks.length, 1);
  assert.equal((await request('/api/bookmarks?view=archive')).data.bookmarks.length, 0);
});

test('SCN-015 saved details remain stable when the source later changes', async () => {
  await save();
  metadataVersion = 2;
  const bookmark = (await request('/api/bookmarks?view=all')).data.bookmarks[0];
  assert.equal(bookmark.title, 'A personal knowledge garden');
});

test('SCN-016 edits title and description without changing address or labels', async () => {
  const bookmark = await save();
  await request(`/api/bookmarks/${bookmark.id}/labels`, { method: 'POST', body: { name: 'learning' } });
  const edited = await request(`/api/bookmarks/${bookmark.id}`, { method: 'PATCH', body: { title: 'My knowledge garden notes', description: 'Ideas I want to revisit.' } });
  assert.equal(edited.data.bookmark.title, 'My knowledge garden notes');
  assert.equal(edited.data.bookmark.description, 'Ideas I want to revisit.');
  assert.equal(edited.data.bookmark.url, 'https://articles.example.com/knowledge');
  assert.deepEqual(edited.data.bookmark.labels, ['learning']);
});

test('SCN-017 restores an archived bookmark intact without restoring Read later', async () => {
  const bookmark = await save();
  await request(`/api/bookmarks/${bookmark.id}/labels`, { method: 'POST', body: { name: 'learning' } });
  await request(`/api/bookmarks/${bookmark.id}`, { method: 'PATCH', body: { readLater: true } });
  await request(`/api/bookmarks/${bookmark.id}`, { method: 'PATCH', body: { archived: true } });
  const restored = await request(`/api/bookmarks/${bookmark.id}`, { method: 'PATCH', body: { archived: false } });
  assert.equal(restored.data.bookmark.archived, false);
  assert.equal(restored.data.bookmark.readLater, false);
  assert.equal(restored.data.bookmark.title, 'A personal knowledge garden');
  assert.deepEqual(restored.data.bookmark.labels, ['learning']);
});
