'use strict';
const test = require('node:test');
const assert = require('node:assert');
const os = require('os');
const path = require('path');
const fs = require('fs');
const http = require('http');

// isolate storage + point the Internet Archive at our local stub BEFORE requiring modules
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'bm-'));
process.env.DATA_DIR = TMP;

// fixture site
let fixture, BASE;
const PNG = Buffer.from('89504e470d0a1a0a', 'hex');
const PDF = Buffer.from('%PDF-1.4\n%stub\n', 'utf8');

function startFixture() {
  return new Promise(resolve => {
    fixture = http.createServer((req, res) => {
      const u = new URL(req.url, 'http://x');
      if (u.pathname === '/page') {
        res.writeHead(200, { 'content-type': 'text/html' });
        res.end('<html><head><title>Fallback</title>' +
          '<meta property="og:title" content="The Real Title">' +
          '<meta property="og:description" content="A real description of the page.">' +
          '<meta property="og:site_name" content="Fixture Site">' +
          '<meta property="og:image" content="/img.png">' +
          '<link rel="icon" href="/fav.ico">' +
          '</head><body><h1>Hi</h1><img src="/img.png"></body></html>');
      } else if (u.pathname === '/fail') { res.writeHead(500); res.end('boom'); }
      else if (u.pathname === '/doc.pdf') { res.writeHead(200, { 'content-type': 'application/pdf' }); res.end(PDF); }
      else if (u.pathname === '/img.png') { res.writeHead(200, { 'content-type': 'image/png' }); res.end(PNG); }
      else if (u.pathname === '/fav.ico') { res.writeHead(200, { 'content-type': 'image/x-icon' }); res.end(PNG); }
      else if (u.pathname.startsWith('/save/')) { res.writeHead(200); res.end('ok'); }
      else { res.writeHead(404); res.end('nf'); }
    });
    fixture.listen(0, '127.0.0.1', () => { BASE = 'http://127.0.0.1:' + fixture.address().port; process.env.ARCHIVE_BASE = BASE; resolve(); });
  });
}

let svc, store;
test.before(async () => { await startFixture(); svc = require('../../src/service'); store = require('../../src/store'); });
test.after(() => new Promise(r => fixture.close(r)));
test.beforeEach(() => store._reset());

test('create fills details automatically (SCN-001)', async () => {
  const r = await svc.createBookmark({ url: BASE + '/page', tags: ['dev'], note: 'n' });
  assert.strictEqual(r.status, 'created');
  assert.strictEqual(r.bookmark.title, 'The Real Title');
  assert.strictEqual(r.bookmark.description, 'A real description of the page.');
  assert.ok(r.bookmark.preview && r.bookmark.preview.endsWith('/img.png'));
  assert.deepStrictEqual(r.bookmark.tags, ['dev']);
  assert.strictEqual(r.bookmark.note, 'n');
  assert.strictEqual(r.bookmark.detailsMissing, false);
});

test('invalid link is rejected (SCN-008)', async () => {
  const r = await svc.createBookmark({ url: 'notalink' });
  assert.strictEqual(r.status, 'invalid');
});

test('duplicate is detected among non-archived (SCN-009)', async () => {
  const a = await svc.createBookmark({ url: BASE + '/page' });
  const b = await svc.createBookmark({ url: BASE + '/page/' }); // trailing slash normalized
  assert.strictEqual(b.status, 'duplicate');
  assert.strictEqual(b.existingId, a.bookmark.id);
});

test('unreadable page still saves with details missing (SCN-010)', async () => {
  const r = await svc.createBookmark({ url: BASE + '/fail' });
  assert.strictEqual(r.status, 'created');
  assert.strictEqual(r.bookmark.detailsMissing, true);
  assert.strictEqual(r.bookmark.title, '');
});

test('edit title/description/note/tags (SCN-003/011)', async () => {
  const c = await svc.createBookmark({ url: BASE + '/page' });
  const r = await svc.updateBookmark(c.bookmark.id, { title: 'Mine', description: 'D', note: '**hi**', tags: ['a', 'b'] });
  assert.strictEqual(r.bookmark.title, 'Mine');
  assert.strictEqual(r.bookmark.note, '**hi**');
  assert.deepStrictEqual(r.bookmark.tags, ['a', 'b']);
});

test('change URL with refresh re-fetches details (SCN-014)', async () => {
  const c = await svc.createBookmark({ url: BASE + '/fail' });
  assert.strictEqual(c.bookmark.detailsMissing, true);
  const r = await svc.updateBookmark(c.bookmark.id, { url: BASE + '/page', refresh: true });
  assert.strictEqual(r.refreshed, true);
  assert.strictEqual(r.bookmark.title, 'The Real Title');
});

test('read-later and archive toggles (SCN-004/005)', async () => {
  const c = await svc.createBookmark({ url: BASE + '/page' });
  await svc.updateBookmark(c.bookmark.id, { readLater: true });
  assert.strictEqual(svc.getBookmark(c.bookmark.id).readLater, true);
  await svc.updateBookmark(c.bookmark.id, { archived: true });
  assert.strictEqual(svc.getBookmark(c.bookmark.id).archived, true);
});

test('delete then restore (SCN-013)', async () => {
  const c = await svc.createBookmark({ url: BASE + '/page' });
  const d = svc.deleteBookmark(c.bookmark.id);
  assert.strictEqual(d.status, 'ok');
  assert.strictEqual(svc.getBookmark(c.bookmark.id), null);
  svc.restoreBookmarks([{ bookmark: d.removed, index: d.index }]);
  assert.ok(svc.getBookmark(c.bookmark.id));
});

test('bulk add/remove tag, read-later, archive, delete (SCN-016/017)', async () => {
  const a = await svc.createBookmark({ url: BASE + '/page' });
  const b = await svc.createBookmark({ url: BASE + '/page?x=2' });
  const ids = [a.bookmark.id, b.bookmark.id];
  svc.bulk(ids, 'add-tag', { tag: 'triage' });
  assert.ok(svc.getBookmark(a.bookmark.id).tags.includes('triage'));
  svc.bulk(ids, 'remove-tag', { tag: 'triage' });
  assert.ok(!svc.getBookmark(a.bookmark.id).tags.includes('triage'));
  svc.bulk(ids, 'read-later');
  assert.strictEqual(svc.getBookmark(a.bookmark.id).readLater, true);
  svc.bulk(ids, 'archive');
  assert.strictEqual(svc.getBookmark(b.bookmark.id).archived, true);
  const del = svc.bulk(ids, 'delete');
  assert.strictEqual(del.removed.length, 2);
  assert.strictEqual(svc.getState().bookmarks.length, 0);
});

test('snapshot a full page and a PDF (SCN-019)', async () => {
  const pg = await svc.createBookmark({ url: BASE + '/page' });
  const s = await svc.snapshot(pg.bookmark.id);
  assert.strictEqual(s.ok, true);
  assert.strictEqual(s.bookmark.snapshot.kind, 'page');
  assert.ok(fs.existsSync(path.join(store.SNAP_DIR, s.bookmark.snapshot.file)));
  const pdf = await svc.createBookmark({ url: BASE + '/doc.pdf' });
  const s2 = await svc.snapshot(pdf.bookmark.id);
  assert.strictEqual(s2.bookmark.snapshot.kind, 'pdf');
});

test('auto-copy on save when preference is on (SCN-019)', async () => {
  svc.updatePreferences({ autoCopy: true });
  const c = await svc.createBookmark({ url: BASE + '/page' });
  assert.ok(c.bookmark.snapshot, 'snapshot created automatically');
});

test('submit to Internet Archive (SCN-020)', async () => {
  const c = await svc.createBookmark({ url: BASE + '/page' });
  const r = await svc.archiveOrg(c.bookmark.id);
  assert.strictEqual(r.ok, true);
  assert.ok(r.bookmark.archiveOrg.url.includes('/web/'));
});

test('import preserves date/tags, folder->tag, skip dupes (SCN-021)', async () => {
  await svc.createBookmark({ url: BASE + '/page' });
  const items = [
    { url: BASE + '/page', folder: 'Work', added: 1497830400, tags: [] },   // duplicate
    { url: 'https://example.org/a', folder: 'Recipes', added: 1600000000, tags: ['quick'] },
  ];
  const r = svc.importBookmarks(items, { addFolderTags: true, skipDupes: true });
  assert.strictEqual(r.imported, 1);
  assert.strictEqual(r.skipped, 1);
  const imported = svc.getState().bookmarks.find(b => b.url.includes('example.org'));
  assert.strictEqual(imported.createdAt, 1600000000 * 1000);
  assert.ok(imported.tags.includes('quick'));
  assert.ok(imported.tags.includes('recipes'));
});

test('saved searches add/remove (SCN-018)', () => {
  const s = svc.addSavedSearch({ name: 'Dev', query: '#dev', tag: null, view: 'all' });
  assert.ok(svc.getState().savedSearches.some(x => x.id === s.id));
  svc.removeSavedSearch(s.id);
  assert.ok(!svc.getState().savedSearches.some(x => x.id === s.id));
});

test('preferences update (SCN-023)', () => {
  const p = svc.updatePreferences({ theme: 'dark', pageSize: 10 });
  assert.strictEqual(p.theme, 'dark');
  assert.strictEqual(p.pageSize, 10);
});
