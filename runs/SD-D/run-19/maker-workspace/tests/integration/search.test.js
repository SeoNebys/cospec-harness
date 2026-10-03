import { test, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, resetDb, api, seed } from './helper.js';

before(startServer);
beforeEach(resetDb);

async function seedSet() {
  await seed('https://a.com/opensource', { title: 'Open Source Guide', description: 'about open source', tags: ['news'] });
  await seed('https://b.com/cats', { title: 'Cats', description: 'furry', tags: ['pets'] });
  await seed('https://c.com/dogs', { title: 'Dogs and AND', description: 'loyal', tags: ['pets'] });
}

test('case-insensitive substring search across fields', async () => {
  await seedSet();
  const r = await api('GET', '/api/bookmarks?q=OPEN');
  assert.equal(r.body.total, 1);
  assert.equal(r.body.items[0].title, 'Open Source Guide');
});

test('#tag with text ANDed - both must match (FR-014)', async () => {
  await seedSet();
  const r = await api('GET', `/api/bookmarks?q=${encodeURIComponent('guide #news')}`);
  assert.equal(r.body.total, 1);
  const none = await api('GET', `/api/bookmarks?q=${encodeURIComponent('guide #pets')}`);
  assert.equal(none.body.total, 0);
});

test('quoted phrase exact match', async () => {
  await seedSet();
  const r = await api('GET', `/api/bookmarks?q=${encodeURIComponent('"open source"')}`);
  assert.equal(r.body.total, 1);
});

test('quoted operator is literal (FR-015)', async () => {
  await seedSet();
  const r = await api('GET', `/api/bookmarks?q=${encodeURIComponent('"AND"')}`);
  assert.equal(r.body.total, 1);
  assert.equal(r.body.items[0].title, 'Dogs and AND');
});

test('boolean OR / NOT / parentheses', async () => {
  await seedSet();
  const orR = await api('GET', `/api/bookmarks?q=${encodeURIComponent('cats OR dogs')}`);
  assert.equal(orR.body.total, 2);
  const notR = await api('GET', `/api/bookmarks?q=${encodeURIComponent('(cats OR dogs) NOT loyal')}`);
  assert.equal(notR.body.total, 1);
  assert.equal(notR.body.items[0].title, 'Cats');
});

test('invalid query returns 400 (FR-017)', async () => {
  const r = await api('GET', `/api/bookmarks?q=${encodeURIComponent('"foo')}`);
  assert.equal(r.status, 400);
});
