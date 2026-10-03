import { test, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, resetDb, api, seed } from './helper.js';

before(startServer);
beforeEach(resetDb);

test('read/unread state and unread view (US6)', async () => {
  const a = await seed('https://a.com/1');
  await seed('https://a.com/2');
  await api('PATCH', `/api/bookmarks/${a.id}`, { isRead: true });
  const unread = await api('GET', '/api/bookmarks?scope=unread');
  assert.equal(unread.body.total, 1);
  assert.notEqual(unread.body.items[0].id, a.id);
});

test('archive excluded from normal/search; present in archive view; restore (US9)', async () => {
  const a = await seed('https://a.com/keep', { title: 'Keep' });
  await api('PATCH', `/api/bookmarks/${a.id}`, { isArchived: true });
  const normal = await api('GET', '/api/bookmarks');
  assert.equal(normal.body.total, 0);
  const search = await api('GET', '/api/bookmarks?q=Keep');
  assert.equal(search.body.total, 0);
  const archive = await api('GET', '/api/bookmarks?scope=archive');
  assert.equal(archive.body.total, 1);
  await api('PATCH', `/api/bookmarks/${a.id}`, { isArchived: false });
  assert.equal((await api('GET', '/api/bookmarks')).body.total, 1);
});

test('tag suggestions by prefix (US7)', async () => {
  await seed('https://a.com/1', { tags: ['news', 'network', 'pets'] });
  const r = await api('GET', '/api/tags?prefix=ne');
  const names = r.body.tags.map((t) => t.name).sort();
  assert.deepEqual(names, ['network', 'news']);
});

test('include/exclude tag filtering (US7)', async () => {
  await seed('https://a.com/1', { tags: ['news'] });
  await seed('https://a.com/2', { tags: ['news', 'sport'] });
  const inc = await api('GET', '/api/bookmarks?includeTags=news');
  assert.equal(inc.body.total, 2);
  const exc = await api('GET', '/api/bookmarks?includeTags=news&excludeTags=sport');
  assert.equal(exc.body.total, 1);
});

test('bulk add tag by ids and mark read (US8)', async () => {
  const a = await seed('https://a.com/1');
  const b = await seed('https://a.com/2');
  const r = await api('POST', '/api/bookmarks/bulk', { selection: { ids: [a.id, b.id] }, action: 'addTags', tags: ['batch'] });
  assert.equal(r.body.affected, 2);
  const list = await api('GET', '/api/bookmarks?includeTags=batch');
  assert.equal(list.body.total, 2);
});

test('bulk select-all-matching respects the current view (US8/FR-023)', async () => {
  await seed('https://a.com/1', { title: 'match one', tags: ['t'] });
  await seed('https://a.com/2', { title: 'match two', tags: ['t'] });
  await seed('https://a.com/3', { title: 'other' });
  const r = await api('POST', '/api/bookmarks/bulk', {
    selection: { matchAll: { q: 'match', scope: 'all' } }, action: 'archive',
  });
  assert.equal(r.body.affected, 2);
  assert.equal((await api('GET', '/api/bookmarks')).body.total, 1); // only "other" left in normal view
  assert.equal((await api('GET', '/api/bookmarks?scope=archive')).body.total, 2);
});

test('bulk delete requires confirmation', async () => {
  const a = await seed('https://a.com/1');
  const noConfirm = await api('POST', '/api/bookmarks/bulk', { selection: { ids: [a.id] }, action: 'delete' });
  assert.equal(noConfirm.status, 400);
  const confirmed = await api('POST', '/api/bookmarks/bulk', { selection: { ids: [a.id] }, action: 'delete', confirmed: true });
  assert.equal(confirmed.body.affected, 1);
});
