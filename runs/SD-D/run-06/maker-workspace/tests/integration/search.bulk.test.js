import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer } from './helper.js';

let srv;
before(async () => {
  srv = await startTestServer();
  await srv.api('POST', '/api/bookmarks', { url: 'https://a.example', title: 'React tutorial', description: 'Learn hooks', tags: ['news', 'tech'] });
  await srv.api('POST', '/api/bookmarks', { url: 'https://b.example', title: 'Vue guide', description: 'ready to ship', tags: ['tech'] });
  await srv.api('POST', '/api/bookmarks', { url: 'https://c.example', title: 'Old news', description: 'archive of stuff', tags: ['news'] });
});
after(async () => { await srv.close(); });

test('case-insensitive plain search across fields (FR-011/FR-012)', async () => {
  const r = await srv.api('GET', '/api/search?q=REACT');
  assert.equal(r.data.total, 1);
  assert.equal(r.data.items[0].title, 'React tutorial');
});

test('#tag constrains results (FR-013)', async () => {
  const r = await srv.api('GET', `/api/search?q=${encodeURIComponent('#news')}`);
  assert.equal(r.data.total, 2);
});

test('implicit AND between word and #tag (FR-013a)', async () => {
  const r = await srv.api('GET', `/api/search?q=${encodeURIComponent('news #tech')}`);
  // "news" matches A (tag) and C (title "Old news"); AND #tech -> only A
  assert.equal(r.data.total, 1);
  assert.equal(r.data.items[0].title, 'React tutorial');
});

test('OR and NOT operators (FR-013)', async () => {
  const or = await srv.api('GET', `/api/search?q=${encodeURIComponent('react OR vue')}`);
  assert.equal(or.data.total, 2);
  const not = await srv.api('GET', `/api/search?q=${encodeURIComponent('#news NOT old')}`);
  assert.equal(not.data.total, 1);
  assert.equal(not.data.items[0].title, 'React tutorial');
});

test('quoted operator is literal text (FR-013b)', async () => {
  const r = await srv.api('GET', `/api/search?q=${encodeURIComponent('"ready to ship"')}`);
  assert.equal(r.data.total, 1);
  assert.equal(r.data.items[0].title, 'Vue guide');
});

test('malformed query returns 400 (FR-014)', async () => {
  const r = await srv.api('GET', `/api/search?q=${encodeURIComponent('(a OR ')}`);
  assert.equal(r.status, 400);
  assert.equal(r.data.error.code, 'bad_query');
});

test('bulk add tag to all matching a search (FR-022/FR-023)', async () => {
  const r = await srv.api('POST', '/api/bookmarks/bulk', {
    selection: { matchQuery: '#news' }, action: 'addTags', tags: ['favorite'],
  });
  assert.equal(r.data.affected, 2);
  const check = await srv.api('GET', `/api/search?q=${encodeURIComponent('#favorite')}`);
  assert.equal(check.data.total, 2);

  const removed = await srv.api('POST', '/api/bookmarks/bulk', {
    selection: { matchQuery: '#favorite' }, action: 'removeTags', tags: ['favorite'],
  });
  assert.equal(removed.data.affected, 2);
  const after = await srv.api('GET', `/api/search?q=${encodeURIComponent('#favorite')}`);
  assert.equal(after.data.total, 0);
});

test('saved view round-trips search + tags (FR-024)', async () => {
  const created = await srv.api('POST', '/api/views', { name: 'Tech news', searchText: 'news', includedTags: ['tech'] });
  assert.equal(created.status, 201);
  const results = await srv.api('GET', `/api/views/${created.data.view.id}/results`);
  assert.equal(results.data.total, 1);
  assert.equal(results.data.items[0].title, 'React tutorial');
});
