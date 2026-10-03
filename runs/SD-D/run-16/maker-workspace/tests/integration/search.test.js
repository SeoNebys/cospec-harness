import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { useTempData } from '../helpers/seed.js';

let app;
let temp;
let svc;

before(async () => {
  temp = useTempData();
  svc = await import('../../src/server/services/bookmarks.js');
  const mod = await import('../../src/server/app.js');
  app = mod.createApp();

  svc.createBookmark({ address: 'https://a.example/budget', title: 'Budget planning', description: 'quarterly numbers', tags: ['work', 'finance'] });
  svc.createBookmark({ address: 'https://b.example/recipe', title: 'Best Recipe', description: 'cooking dinner', tags: ['food'] });
  svc.createBookmark({ address: 'https://c.example/old', title: 'Archived item', description: 'set aside', tags: ['work'], isArchived: true });
});

after(() => temp.cleanup());

async function search(q, extra = {}) {
  const params = new URLSearchParams({ q, ...extra });
  const res = await request(app).get(`/api/search?${params}`);
  return res;
}

test('list returns non-archived bookmarks with fields', async () => {
  const res = await request(app).get('/api/bookmarks?view=normal');
  assert.equal(res.status, 200);
  assert.equal(res.body.total, 2); // archived excluded
  assert.ok(res.body.items[0].title);
});

test('case-insensitive text search across fields', async () => {
  const res = await search('BUDGET');
  assert.equal(res.status, 200);
  assert.equal(res.body.total, 1);
  assert.match(res.body.items[0].title, /Budget/);
});

test('#tag search restricts to tag membership and excludes archived', async () => {
  const res = await search('#work');
  assert.equal(res.body.total, 1); // only the non-archived work bookmark
  assert.equal(res.body.items[0].address, 'https://a.example/budget');
});

test('text AND #tag combination', async () => {
  assert.equal((await search('budget #work')).body.total, 1);
  assert.equal((await search('budget #food')).body.total, 0);
});

test('OR and quoted literal operator', async () => {
  assert.equal((await search('budget OR recipe')).body.total, 2);
  // "AND" quoted is literal text -> matches nothing here
  assert.equal((await search('"AND"')).body.total, 0);
});

test('no-results query returns empty set', async () => {
  const res = await search('zzz-nothing-here');
  assert.equal(res.body.total, 0);
  assert.deepEqual(res.body.items, []);
});

test('malformed query returns 400', async () => {
  const res = await search('(budget OR');
  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, 'search_invalid');
});

test('matchedIds is returned for select-all-matching', async () => {
  const res = await search('#work');
  assert.ok(Array.isArray(res.body.matchedIds));
  assert.equal(res.body.matchedIds.length, 1);
});
