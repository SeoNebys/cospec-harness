// API/integration acceptance tests covering the approved scenarios end-to-end.
// Uses a temporary data dir and no network (keepCopy:false, ia:false) so tests
// are deterministic and offline.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bm-'));
process.env.BM_DATA_DIR = tmp;
const { app } = require('../server');

let base, server;
test.before(async () => {
  await new Promise((res) => { server = app.listen(0, '127.0.0.1', () => { base = `http://127.0.0.1:${server.address().port}`; res(); }); });
});
test.after(async () => { await new Promise((res) => server.close(res)); });

const j = async (method, url, body, asText) => {
  const opts = { method, headers: {} };
  if (body != null) { opts.headers['Content-Type'] = asText ? 'text/html' : 'application/json'; opts.body = asText ? body : JSON.stringify(body); }
  const r = await fetch(base + url, opts);
  const ct = r.headers.get('content-type') || '';
  return { status: r.status, body: ct.includes('json') ? await r.json() : await r.text() };
};
const mk = (over = {}) => Object.assign({ url: 'https://ex.example/a', title: 'A', tags: [], note: '', keepCopy: false, ia: false }, over);

test('SCN-001 create with fallback title (SCN-002)', async () => {
  const r = await j('POST', '/api/bookmarks', mk({ url: 'https://ex.example/notitle', title: '' }));
  assert.strictEqual(r.body.bookmark.title, 'https://ex.example/notitle');
  assert.strictEqual(r.body.bookmark.status, 'toread');
});

test('SCN-003 duplicate address edits in place, no second copy', async () => {
  const a = await j('POST', '/api/bookmarks', mk({ url: 'https://dup.example/p', title: 'first' }));
  const id = a.body.bookmark.id;
  const b = await j('POST', '/api/bookmarks', mk({ url: 'https://www.dup.example/p/', title: 'second' }));
  assert.strictEqual(b.body.duplicate, true);
  assert.strictEqual(b.body.bookmark.id, id);
  const state = (await j('GET', '/api/state')).body;
  assert.strictEqual(state.bookmarks.filter(x => x.id === id).length, 1);
  assert.strictEqual(state.bookmarks.find(x => x.id === id).title, 'second');
});

test('SCN-004/006 status and archive keep remembered status', async () => {
  const c = (await j('POST', '/api/bookmarks', mk({ url: 'https://st.example/1' }))).body.bookmark;
  await j('PATCH', `/api/bookmarks/${c.id}`, { status: 'done' });
  await j('PATCH', `/api/bookmarks/${c.id}`, { archived: true });
  let b = (await j('GET', '/api/state')).body.bookmarks.find(x => x.id === c.id);
  assert.strictEqual(b.archived, true);
  assert.strictEqual(b.status, 'done'); // remembered
  await j('PATCH', `/api/bookmarks/${c.id}`, { archived: false });
  b = (await j('GET', '/api/state')).body.bookmarks.find(x => x.id === c.id);
  assert.strictEqual(b.archived, false);
  assert.strictEqual(b.status, 'done'); // restored to prior status
});

test('SCN-007 delete removes entirely', async () => {
  const c = (await j('POST', '/api/bookmarks', mk({ url: 'https://del.example/1' }))).body.bookmark;
  await j('DELETE', `/api/bookmarks/${c.id}`);
  assert.strictEqual((await j('GET', '/api/state')).body.bookmarks.some(x => x.id === c.id), false);
});

test('SCN-017 bulk archive preserves each status; bulk tag add/remove', async () => {
  const a = (await j('POST', '/api/bookmarks', mk({ url: 'https://bulk.example/1' }))).body.bookmark;
  const b = (await j('POST', '/api/bookmarks', mk({ url: 'https://bulk.example/2' }))).body.bookmark;
  await j('PATCH', `/api/bookmarks/${b.id}`, { status: 'done' });
  await j('POST', '/api/bookmarks/bulk', { ids: [a.id, b.id], action: 'archive' });
  await j('POST', '/api/bookmarks/bulk', { ids: [a.id, b.id], action: 'addTag', value: 'grp' });
  let st = (await j('GET', '/api/state')).body.bookmarks;
  const A = st.find(x => x.id === a.id), Bk = st.find(x => x.id === b.id);
  assert.strictEqual(A.archived && Bk.archived, true);
  assert.strictEqual(A.status, 'toread'); assert.strictEqual(Bk.status, 'done');
  assert.ok(A.tags.includes('grp') && Bk.tags.includes('grp'));
  await j('POST', '/api/bookmarks/bulk', { ids: [a.id], action: 'removeTag', value: 'grp' });
  st = (await j('GET', '/api/state')).body.bookmarks;
  assert.strictEqual(st.find(x => x.id === a.id).tags.includes('grp'), false);
});

test('SCN-014/022 prefs persist and are validated', async () => {
  await j('PUT', '/api/prefs', { sortKey: 'title_asc', pageSize: 25, textSize: 'l' });
  const p = (await j('GET', '/api/state')).body.prefs;
  assert.strictEqual(p.sortKey, 'title_asc'); assert.strictEqual(p.pageSize, 25); assert.strictEqual(p.textSize, 'l');
  const r = await j('PUT', '/api/prefs', { pageSize: 999 }); // invalid ignored
  assert.strictEqual(r.body.prefs.pageSize, 25);
});

test('SCN-020 saved searches add/remove and persist', async () => {
  const s = (await j('POST', '/api/searches', { name: 'Rome', query: 'rome #book', view: 'toread' })).body.search;
  assert.ok((await j('GET', '/api/state')).body.savedSearches.some(x => x.id === s.id));
  await j('DELETE', `/api/searches/${s.id}`);
  assert.strictEqual((await j('GET', '/api/state')).body.savedSearches.some(x => x.id === s.id), false);
});

test('SCN-021 import preserves fields, skips duplicates; export round-trips', async () => {
  const html = `<DL><p>
    <DT><A HREF="https://imp.example/one" ADD_DATE="1600000000" TAGS="x,y">One</A>
    <DD>note one
    <DT><A HREF="https://imp.example/two" ADD_DATE="1610000000">Two</A></DL>`;
  const r1 = await j('POST', '/api/import', html, true);
  assert.strictEqual(r1.body.added, 2);
  const one = (await j('GET', '/api/state')).body.bookmarks.find(b => b.url === 'https://imp.example/one');
  assert.deepStrictEqual(one.tags, ['x', 'y']);
  assert.strictEqual(one.createdAt, 1600000000 * 1000);
  assert.strictEqual(one.note, 'note one');
  assert.strictEqual(one.status, 'toread');
  const r2 = await j('POST', '/api/import', html, true); // dedupe
  assert.strictEqual(r2.body.added, 0);
  assert.strictEqual(r2.body.skipped, 2);
  const exp = await j('GET', '/api/export');
  assert.match(exp.body, /HREF="https:\/\/imp\.example\/one"/);
  assert.match(exp.body, /ADD_DATE="1600000000"/);
  assert.match(exp.body, /TAGS="x,y"/);
});

test('SCN-012 invalid url rejected by create', async () => {
  const r = await j('POST', '/api/bookmarks', mk({ url: 'not a url' }));
  assert.strictEqual(r.status, 400);
});
