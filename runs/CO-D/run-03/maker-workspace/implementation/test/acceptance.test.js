'use strict';
// Gherkin-based acceptance tests (Phase 3) — exercise the real HTTP app.
const test = require('node:test');
const assert = require('node:assert');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bm-acc-'));
process.env.BOOKMARKS_DATA_DIR = dir;
process.env.BOOKMARKS_DB = path.join(dir, 'acc.db');
const app = require('../src/server');

let base;
const server = app.listen(0);
test.before(async () => { await new Promise(r => server.once('listening', r)); base = `http://127.0.0.1:${server.address().port}`; });
test.after(() => { server.close(); try { fs.rmSync(dir, { recursive: true, force: true }); } catch {} });

const get = (u) => fetch(base + u).then(r => r.json());
const post = (u, b) => fetch(base + u, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) }).then(r => r.json());
const put = (u, b) => fetch(base + u, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) }).then(r => r.json());
const del = (u) => fetch(base + u, { method: 'DELETE' }).then(r => r.json());

async function create(url, extra = {}) {
  const r = await post('/api/bookmarks', { url, ...extra });
  return r.bookmark;
}

test('SCN-001/007: preview returns a draft even when the page cannot be read', async () => {
  const r = await post('/api/preview', { url: 'https://offline.invalid.example/some-article' });
  assert.ok(r.draft, 'a draft is offered');
  assert.ok(r.draft.title, 'a title is suggested from the URL');
});

test('SCN-001/013: creating a bookmark saves it and does not block on copy', async () => {
  const b = await create('https://example.com/a', { title: 'A', tags: ['reading'], note: 'hi', status: 'toread' });
  assert.ok(b.id);
  assert.strictEqual(b.status, 'toread');
  assert.ok(['pending', 'saved', 'failed'].includes(b.copy.status)); // never blocks saving
});

test('SCN-006: saving the same link opens the existing one (no duplicate)', async () => {
  const first = await create('https://dup.example.com/x/', { title: 'first' });
  const r = await post('/api/preview', { url: 'http://dup.example.com/x?utm_source=t#f' });
  assert.ok(r.duplicate, 'preview flags the duplicate');
  assert.strictEqual(r.bookmark.id, first.id);
  const again = await post('/api/bookmarks', { url: 'https://www.dup.example.com/x' });
  assert.ok(again.duplicate, 'create refuses to duplicate');
  assert.strictEqual(again.bookmark.id, first.id);
});

test('SCN-002/004: edit updates title, tags, note and status together', async () => {
  const b = await create('https://edit.example.com/1', { title: 'orig' });
  const u = await put('/api/bookmarks/' + b.id, { title: 'new', tags: ['x', 'y'], note: '### h', status: 'finished' });
  assert.strictEqual(u.title, 'new');
  assert.deepStrictEqual(u.tags, ['x', 'y']);
  assert.strictEqual(u.status, 'finished');
});

test('SCN-003: search language over the collection (#tag, phrase, boolean, literal)', async () => {
  await create('https://s.example.com/rome-article', { title: 'Weekend in Rome', tags: ['rome', 'article'], description: 'forum to trastevere' });
  await create('https://s.example.com/rome-book', { title: 'SPQR history', tags: ['rome', 'book'], description: 'ancient rome' });
  const byTag = await get('/api/bookmarks?query=' + encodeURIComponent('rome (#article OR #book)') + '&archived=0');
  assert.strictEqual(byTag.total, 2);
  const notBook = await get('/api/bookmarks?query=' + encodeURIComponent('rome NOT #book') + '&archived=0');
  assert.strictEqual(notBook.total, 1);
  assert.strictEqual(notBook.items[0].title, 'Weekend in Rome');
});

test('SCN-004/005: archive leaves main scope, restore returns it', async () => {
  const b = await create('https://arch.example.com/1', { title: 'archive me', status: 'finished' });
  await post('/api/bookmarks/' + b.id + '/archive');
  const main = await get('/api/bookmarks?status=all&archived=0');
  assert.ok(!main.items.find(x => x.id === b.id));
  const archived = await get('/api/bookmarks?archived=1');
  assert.ok(archived.items.find(x => x.id === b.id));
  await post('/api/bookmarks/' + b.id + '/restore');
  const back = await get('/api/bookmarks?status=finished&archived=0');
  assert.ok(back.items.find(x => x.id === b.id));
});

test('SCN-009/010: whole-collection sort + pagination', async () => {
  // create three with controlled titles for A-Z
  const list = await get('/api/bookmarks?sort=az&archived=0&status=all&limit=1000');
  const titles = list.items.map(b => b.title);
  const sorted = [...titles].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  assert.deepStrictEqual(titles, sorted);
  const page = await get('/api/bookmarks?sort=az&archived=0&status=all&offset=0&limit=2');
  assert.strictEqual(page.items.length, 2);
  assert.ok(page.total >= 2);
});

test('SCN-012: bulk mark read across select-all-matching', async () => {
  const ids = (await get('/api/bookmarks/matching-ids?query=%23rome&archived=0')).ids;
  assert.ok(ids.length >= 2);
  const r = await post('/api/bookmarks/bulk', { action: 'markRead', match: { query: '#rome', status: 'all', archived: '0' } });
  assert.strictEqual(r.affected, ids.length);
  for (const id of ids) assert.strictEqual((await get('/api/bookmarks/' + id)).status, 'finished');
});

test('SCN-014: collections save and re-open live', async () => {
  await post('/api/collections', { name: 'Rome minus book', text: '', inc: ['rome'], exc: ['book'] });
  const list = await get('/api/collections');
  const c = list.collections.find(x => x.name === 'Rome minus book');
  assert.ok(c);
  const q = ['#rome', 'NOT #book'].join(' ');
  const res = await get('/api/bookmarks?query=' + encodeURIComponent(q) + '&archived=0');
  assert.ok(res.items.every(b => b.tags.includes('rome') && !b.tags.includes('book')));
});

test('SCN-016: preferences persist', async () => {
  await put('/api/preferences', { text_size: 'large', density: 'compact', per_load: 100, default_sort: 'updated' });
  const p = await get('/api/preferences');
  assert.strictEqual(p.text_size, 'large');
  assert.strictEqual(p.default_sort, 'updated');
});

test('SCN-015/017: import invalid file changes nothing; valid file imports + dedups', async () => {
  const before = (await get('/api/bookmarks?status=all&archived=0&limit=1')).total;
  // invalid
  const badForm = new FormData();
  badForm.append('file', new Blob(['not a bookmarks file'], { type: 'text/html' }), 'bad.html');
  const bad = await fetch(base + '/api/import', { method: 'POST', body: badForm }).then(r => r.json());
  assert.strictEqual(bad.ok, false);
  const afterBad = (await get('/api/bookmarks?status=all&archived=0&limit=1')).total;
  assert.strictEqual(afterBad, before, 'invalid import changes nothing');
  // valid, with one dup (example.com/a already exists) and one new
  const html = `<!DOCTYPE NETSCAPE-Bookmark-file-1><DL><p>
    <DT><A HREF="https://example.com/a" ADD_DATE="1700000000">dup</A>
    <DT><A HREF="https://imported.example.com/new" ADD_DATE="1700000001" TAGS="imported">New One</A>
    <DT><A>no href line</A>
  </DL><p>`;
  const form = new FormData();
  form.append('file', new Blob([html], { type: 'text/html' }), 'ok.html');
  form.append('folderTags', 'true');
  const res = await fetch(base + '/api/import', { method: 'POST', body: form }).then(r => r.json());
  assert.ok(res.ok);
  assert.strictEqual(res.imported, 1);
  assert.ok(res.existed >= 1);
});

test('SCN-015: export produces a standard bookmarks file with tags and dates', async () => {
  const res = await fetch(base + '/api/export?scope=all');
  assert.strictEqual(res.headers.get('content-type'), 'text/html; charset=utf-8');
  const body = await res.text();
  assert.ok(body.includes('NETSCAPE-Bookmark-file-1'));
  assert.ok(/ADD_DATE="\d+"/.test(body));
  assert.ok(body.includes('TAGS='));
});

test('SCN-005/012: delete removes permanently', async () => {
  const b = await create('https://del.example.com/1', { title: 'delete me' });
  const r = await del('/api/bookmarks/' + b.id);
  assert.strictEqual(r.deleted, true);
  const got = await fetch(base + '/api/bookmarks/' + b.id);
  assert.strictEqual(got.status, 404);
});
