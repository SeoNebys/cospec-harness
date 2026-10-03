import { test, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, resetDb, api, seed } from './helper.js';

before(startServer);
beforeEach(resetDb);

test('create returns a full bookmark with derived-title fallback', async () => {
  const { status, body } = await api('POST', '/api/bookmarks', { url: 'https://example.com/a' });
  assert.equal(status, 201);
  assert.equal(body.title, 'example.com/a'); // derived
  assert.equal(body.isRead, false);
  assert.equal(body.isArchived, false);
});

test('invalid URL rejected with 400', async () => {
  const { status } = await api('POST', '/api/bookmarks', { url: 'not-a-url' });
  assert.equal(status, 400);
});

test('duplicate create returns existing id, no second row (US2/FR-005)', async () => {
  const first = await seed('https://example.com/dup');
  const { status, body } = await api('POST', '/api/bookmarks', { url: 'https://example.com/dup/' });
  assert.equal(status, 200);
  assert.equal(body.existing.id, first.id);
  const list = await api('GET', '/api/bookmarks');
  assert.equal(list.body.total, 1);
});

test('edit updates fields; url conflict returns 409 (FR-007)', async () => {
  const a = await seed('https://a.com/1');
  const b = await seed('https://b.com/2');
  const edit = await api('PATCH', `/api/bookmarks/${a.id}`, { title: 'New title', noteMd: '**hi**', tags: ['x'] });
  assert.equal(edit.status, 200);
  assert.equal(edit.body.title, 'New title');
  assert.match(edit.body.noteHtml, /<strong>hi<\/strong>/);
  assert.deepEqual(edit.body.tags, ['x']);
  const conflict = await api('PATCH', `/api/bookmarks/${b.id}`, { url: 'https://a.com/1' });
  assert.equal(conflict.status, 409);
});

test('delete removes the bookmark', async () => {
  const a = await seed('https://a.com/del');
  const del = await api('DELETE', `/api/bookmarks/${a.id}`);
  assert.equal(del.status, 204);
  const list = await api('GET', '/api/bookmarks');
  assert.equal(list.body.total, 0);
});

test('list sorts by title and date', async () => {
  await seed('https://a.com/1', { title: 'Zebra' });
  await seed('https://a.com/2', { title: 'Apple' });
  const asc = await api('GET', '/api/bookmarks?sort=title_asc');
  assert.deepEqual(asc.body.items.map((b) => b.title), ['Apple', 'Zebra']);
  const desc = await api('GET', '/api/bookmarks?sort=title_desc');
  assert.deepEqual(desc.body.items.map((b) => b.title), ['Zebra', 'Apple']);
});
