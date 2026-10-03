import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer } from './helper.js';

let srv;
before(async () => {
  srv = await startTestServer();
  // 30 bookmarks all tagged "batch" — more than a typical page size.
  for (let i = 0; i < 30; i++) {
    await srv.api('POST', '/api/bookmarks', { url: `https://item${i}.example`, title: `Item ${i}`, tags: ['batch'] });
  }
});
after(async () => { await srv.close(); });

test('select-all-matching by tag applies to ALL results, not just one page (FR-022)', async () => {
  // The visible page is limited (pageSize=5), but the bulk selector covers all.
  const page = await srv.api('GET', '/api/bookmarks?view=all&tag=batch&pageSize=5');
  assert.equal(page.data.items.length, 5, 'page is limited');
  assert.equal(page.data.total, 30, 'but 30 match the filter');

  const res = await srv.api('POST', '/api/bookmarks/bulk', {
    selection: { matchView: 'all', matchIncludedTags: ['batch'] },
    action: 'archive',
  });
  assert.equal(res.data.affected, 30, 'bulk affected every matching bookmark, beyond the page');

  const normal = await srv.api('GET', '/api/bookmarks?view=all&tag=batch');
  assert.equal(normal.data.total, 0, 'all archived, none remain in normal view');
  const archived = await srv.api('GET', '/api/bookmarks?view=archive');
  assert.equal(archived.data.total, 30);
});

test('select-all-matching by search query applies across all pages (FR-022)', async () => {
  // Restore, then add a tag to everything matching a search across all pages.
  await srv.api('POST', '/api/bookmarks/bulk', { selection: { matchView: 'archive', matchIncludedTags: ['batch'] }, action: 'restore' });

  const search = await srv.api('GET', '/api/search?q=Item&pageSize=5');
  assert.equal(search.data.total, 30);

  const res = await srv.api('POST', '/api/bookmarks/bulk', {
    selection: { matchQuery: 'Item' }, action: 'addTags', tags: ['reviewed'],
  });
  assert.equal(res.data.affected, 30);

  const check = await srv.api('GET', `/api/search?q=${encodeURIComponent('#reviewed')}`);
  assert.equal(check.data.total, 30);
});

test('select-all-matching by saved view id (FR-022/FR-024)', async () => {
  const view = await srv.api('POST', '/api/views', { name: 'Batch items', includedTags: ['batch'] });
  const res = await srv.api('POST', '/api/bookmarks/bulk', {
    selection: { matchViewId: view.data.view.id }, action: 'markRead',
  });
  assert.equal(res.data.affected, 30);
});

test('explicit id selection still targets only those ids', async () => {
  const list = await srv.api('GET', '/api/bookmarks?pageSize=3');
  const ids = list.data.items.map((b) => b.id);
  const res = await srv.api('POST', '/api/bookmarks/bulk', { selection: { ids }, action: 'markUnread' });
  assert.equal(res.data.affected, 3);
});
