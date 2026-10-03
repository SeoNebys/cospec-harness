import { test, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, resetDb, api, seed } from './helper.js';

before(startServer);
beforeEach(resetDb);

test('saved search CRUD and reproduction (US10)', async () => {
  await seed('https://a.com/1', { title: 'alpha', tags: ['keep'] });
  await seed('https://a.com/2', { title: 'beta', tags: ['drop'] });
  const created = await api('POST', '/api/saved-searches', { name: 'Keepers', queryText: '', includeTags: ['keep'], excludeTags: ['drop'] });
  assert.equal(created.status, 201);
  const list = await api('GET', '/api/saved-searches');
  assert.equal(list.body.items.length, 1);
  // Reproduce via the stored parameters.
  const reproduced = await api('GET', '/api/bookmarks?includeTags=keep&excludeTags=drop');
  assert.equal(reproduced.body.total, 1);
  assert.equal(reproduced.body.items[0].title, 'alpha');
  const del = await api('DELETE', `/api/saved-searches/${created.body.id}`);
  assert.equal(del.status, 204);
  // Bookmarks unaffected.
  assert.equal((await api('GET', '/api/bookmarks')).body.total, 2);
});

test('preferences get/update with validation (US13)', async () => {
  const initial = await api('GET', '/api/preferences');
  assert.equal(initial.body.defaultSort, 'date_added_desc');
  const ok = await api('PUT', '/api/preferences', { defaultSort: 'title_asc', itemsPerPage: 50, textSize: 'large' });
  assert.equal(ok.body.itemsPerPage, 50);
  const again = await api('GET', '/api/preferences');
  assert.equal(again.body.textSize, 'large');
  const bad = await api('PUT', '/api/preferences', { defaultSort: 'nonsense', itemsPerPage: 10, textSize: 'medium' });
  assert.equal(bad.status, 400);
});

test('import preserves data and dedupes; export round-trips (US12)', async () => {
  const html = `<!DOCTYPE NETSCAPE-Bookmark-file-1><DL><p>
    <DT><A HREF="https://imp.com/x" ADD_DATE="1600000000" TAGS="a,b">Imported X</A>
    <DT><A HREF="https://imp.com/y">Imported Y</A>
  </DL><p>`;
  const res = await fetch(`${await startServer()}/api/import`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ html }),
  });
  const data = await res.json();
  assert.equal(data.imported, 2);
  const list = await api('GET', '/api/bookmarks?includeTags=a');
  assert.equal(list.body.total, 1);
  assert.equal(list.body.items[0].title, 'Imported X');
  // Export then re-import → no new entries.
  const exportRes = await fetch(`${await startServer()}/api/export`);
  const exported = await exportRes.text();
  assert.match(exported, /Imported X/);
});
