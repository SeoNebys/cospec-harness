import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer } from './helper.js';

let srv;
before(async () => { srv = await startTestServer(); });
after(async () => { await srv.close(); });

test('saving the same address routes to the existing bookmark, no copy (FR-007/SC-003)', async () => {
  const first = await srv.api('POST', '/api/bookmarks', { url: 'https://dup.example/a', title: 'Original' });
  assert.equal(first.status, 201);
  const id = first.data.bookmark.id;

  const second = await srv.api('POST', '/api/bookmarks', { url: 'https://dup.example/a', title: 'Different Title' });
  assert.equal(second.status, 200);
  assert.equal(second.data.duplicate, true);
  assert.equal(second.data.bookmark.id, id);
  assert.equal(second.data.bookmark.title, 'Original', 'existing data not silently overwritten');

  const list = await srv.api('GET', '/api/bookmarks');
  assert.equal(list.data.total, 1, 'no duplicate row created');
});

test('trivial variants are treated as the same address', async () => {
  await srv.api('POST', '/api/bookmarks', { url: 'https://variant.example/a', title: 'V' });
  const variants = ['variant.example/a', 'HTTPS://Variant.Example/a', 'https://variant.example/a'];
  for (const v of variants) {
    const r = await srv.api('POST', '/api/bookmarks', { url: v });
    assert.equal(r.data.duplicate, true, `variant should match: ${v}`);
  }
  const list = await srv.api('GET', '/api/bookmarks?tag=');
});

test('editing an address into another bookmark returns 409 (FR-004/FR-007)', async () => {
  const a = await srv.api('POST', '/api/bookmarks', { url: 'https://clash-a.example' });
  const b = await srv.api('POST', '/api/bookmarks', { url: 'https://clash-b.example' });
  const res = await srv.api('PATCH', `/api/bookmarks/${b.data.bookmark.id}`, { url: 'https://clash-a.example' });
  assert.equal(res.status, 409);
  assert.equal(res.data.existingId, a.data.bookmark.id);
});

test('archived items are excluded from normal browse and search (FR-018)', async () => {
  const c = await srv.api('POST', '/api/bookmarks', { url: 'https://archiveme.example', title: 'ArchiveMe' });
  await srv.api('POST', `/api/bookmarks/${c.data.bookmark.id}/archive`, { archived: true });

  const all = await srv.api('GET', '/api/bookmarks?view=all');
  assert.ok(!all.data.items.some((x) => x.id === c.data.bookmark.id), 'not in normal browse');

  const archive = await srv.api('GET', '/api/bookmarks?view=archive');
  assert.ok(archive.data.items.some((x) => x.id === c.data.bookmark.id), 'in archive view');

  const search = await srv.api('GET', '/api/search?q=ArchiveMe');
  assert.equal(search.data.total, 0, 'archived excluded from search');
});
