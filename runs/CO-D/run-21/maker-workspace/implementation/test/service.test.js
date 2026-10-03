'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { Store } = require('../lib/store');
const { Service } = require('../lib/service');
const { normalizeUrl } = require('../lib/util');
const { parseNetscape, buildNetscape } = require('../lib/netscape');

function tmpDir() { return fs.mkdtempSync(path.join(os.tmpdir(), 'bm-')); }

// fake fetch backed by a fixture map
function makeFetch(fixtures) {
  return async (url) => {
    const f = fixtures[url];
    if (!f) return resp(false, 404, '', '');
    return resp(true, 200, f.body || '', f.contentType || 'text/html');
  };
}
function resp(ok, status, body, contentType) {
  const b = Buffer.from(body || '');
  return {
    ok, status,
    headers: { get: (h) => (h.toLowerCase() === 'content-type' ? contentType : null) },
    async text() { return body || ''; },
    async arrayBuffer() { return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); },
  };
}
function svc(fixtures) {
  const store = new Store(tmpDir());
  return new Service(store, { capOpts: { fetch: makeFetch(fixtures || {}), inlineImages: true } });
}

test('normalizeUrl same-address rule (SCN-005)', () => {
  const a = 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Closures';
  const b = 'https://WWW.DEVELOPER.MOZILLA.ORG/en-US/docs/Web/JavaScript/Closures/';
  const c = 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/CLOSURES';
  assert.equal(normalizeUrl(a), normalizeUrl(b));
  assert.notEqual(normalizeUrl(a), normalizeUrl(c)); // path case matters
});

test('create with auto-fill + preserved copy (SCN-001, SCN-014)', async () => {
  const s = svc({ 'https://ex.com/a': { body: '<title>Hello</title><meta name="description" content="Desc here"><img src="/i.png">' }, 'https://ex.com/i.png': { body: 'PNG', contentType: 'image/png' } });
  const r = await s.createBookmark({ url: 'https://ex.com/a', tags: ['Reading'] });
  assert.ok(r.bookmark);
  assert.equal(r.bookmark.title, 'Hello');
  assert.equal(r.bookmark.description, 'Desc here');
  assert.equal(r.bookmark.preserved.status, 'saved');
  const snap = s.store.readSnapshot(r.bookmark.id, 'page').toString();
  assert.match(snap, /Saved copy of the page/);
  assert.match(snap, /data:image\/png;base64/); // image inlined -> self-contained
});

test('user title/description override auto-fill; read-later default (SCN-001, SCN-012)', async () => {
  const s = svc({ 'https://ex.com/a': { body: '<title>Auto</title>' } });
  const r = await s.createBookmark({ url: 'https://ex.com/a', title: 'Mine', description: 'D', read: false });
  assert.equal(r.bookmark.title, 'Mine');
  assert.equal(r.bookmark.read, false);
  const r2 = await s.createBookmark({ url: 'https://ex.com/b', read: true }); // "already read"
  assert.equal(r2.bookmark.read, true);
});

test('duplicate prevention on create (SCN-005)', async () => {
  const s = svc({ 'https://ex.com/a': { body: '<title>A</title>' } });
  await s.createBookmark({ url: 'https://ex.com/a' });
  const dup = await s.createBookmark({ url: 'https://WWW.EX.COM/a/' });
  assert.equal(dup.duplicate, true);
});

test('case-insensitive tag reuse (SCN-002)', async () => {
  const s = svc({ 'https://ex.com/a': { body: '<title>A</title>' }, 'https://ex.com/b': { body: '<title>B</title>' } });
  await s.createBookmark({ url: 'https://ex.com/a', tags: ['javascript'] });
  const r = await s.createBookmark({ url: 'https://ex.com/b', tags: ['JavaScript', 'JAVASCRIPT'] });
  assert.deepEqual(r.bookmark.tags, ['javascript']);
});

test('edit in place, and address collision blocked (SCN-006)', async () => {
  const s = svc({ 'https://ex.com/a': { body: '<title>A</title>' }, 'https://ex.com/b': { body: '<title>B</title>' } });
  const a = (await s.createBookmark({ url: 'https://ex.com/a' })).bookmark;
  const b = (await s.createBookmark({ url: 'https://ex.com/b' })).bookmark;
  const up = s.updateBookmark(b.id, { title: 'B2', tags: ['x'] });
  assert.equal(up.bookmark.title, 'B2');
  const clash = s.updateBookmark(b.id, { url: 'https://ex.com/a' });
  assert.equal(clash.error, 'duplicate');
});

test('unreadable save then successful retry fills only blanks (SCN-008)', async () => {
  const fixtures = {}; // nothing reachable yet
  const s = svc(fixtures);
  const r = await s.createBookmark({ url: 'https://blocked.example/x', title: 'My title' });
  assert.equal(r.readable, false);
  assert.equal(r.bookmark.contentCollected, false);
  assert.equal(r.bookmark.preserved.status, 'none');
  // page becomes available
  fixtures['https://blocked.example/x'] = { body: '<title>Now readable</title><meta name="description" content="fresh">' };
  const rr = await s.retry(r.bookmark.id);
  assert.equal(rr.readable, true);
  assert.equal(rr.bookmark.title, 'My title');       // kept user's title
  assert.equal(rr.bookmark.description, 'fresh');    // filled blank description
  assert.equal(rr.bookmark.preserved.status, 'saved');
});

test('PDF preservation keeps the file (SCN-014)', async () => {
  const s = svc({ 'https://ex.com/p.pdf': { body: '%PDF-1.4 fake', contentType: 'application/pdf' } });
  const r = await s.createBookmark({ url: 'https://ex.com/p.pdf' });
  assert.equal(r.bookmark.preserved.kind, 'pdf');
  assert.equal(s.store.readSnapshot(r.bookmark.id, 'pdf').toString(), '%PDF-1.4 fake');
});

test('archive keeps copy; delete removes it (SCN-013, SCN-014)', async () => {
  const s = svc({ 'https://ex.com/a': { body: '<title>A</title>' } });
  const a = (await s.createBookmark({ url: 'https://ex.com/a' })).bookmark;
  s.updateBookmark(a.id, { archived: true });
  assert.ok(s.store.readSnapshot(a.id, 'page')); // still there after archive
  s.deleteBookmark(a.id);
  assert.equal(s.store.readSnapshot(a.id, 'page'), null); // gone after delete
});

test('bulk actions on ids (SCN-015)', async () => {
  const s = svc({ 'https://ex.com/1': { body: '<title>1</title>' }, 'https://ex.com/2': { body: '<title>2</title>' } });
  const a = (await s.createBookmark({ url: 'https://ex.com/1' })).bookmark;
  const b = (await s.createBookmark({ url: 'https://ex.com/2' })).bookmark;
  s.bulk('read', [a.id, b.id]);
  assert.ok(s.store.getBookmark(a.id).read && s.store.getBookmark(b.id).read);
  s.bulk('addTag', [a.id, b.id], { tag: 'batch' });
  assert.ok(s.store.getBookmark(a.id).tags.includes('batch'));
  s.bulk('removeTag', [a.id], { tag: 'batch' });
  assert.ok(!s.store.getBookmark(a.id).tags.includes('batch'));
  s.bulk('archive', [a.id]);
  assert.equal(s.store.getBookmark(a.id).archived, true);
  s.bulk('delete', [b.id]);
  assert.equal(s.store.getBookmark(b.id), undefined);
});

test('import maps folders to tags, keeps dates, skips duplicates (SCN-017)', async () => {
  const s = svc({ 'https://ex.com/a': { body: '<title>A</title>' } });
  await s.createBookmark({ url: 'https://ex.com/a' }); // pre-existing
  const html = '<!DOCTYPE NETSCAPE-Bookmark-file-1><DL><p>'
    + '<DT><H3>Reading</H3><DL><p>'
    + '<DT><A HREF="https://ex.com/r" ADD_DATE="1609459200" TAGS="rust">Rust</A>'
    + '<DT><A HREF="https://ex.com/a" ADD_DATE="1610000000">Dup</A>'
    + '</DL><p></DL><p>';
  const res = s.importNetscape(html);
  assert.equal(res.added, 1);
  assert.equal(res.skipped, 1);
  const imported = s.store.db.bookmarks.find(b => b.url === 'https://ex.com/r');
  assert.ok(imported.tags.includes('rust'));
  assert.ok(imported.tags.includes('Reading')); // folder -> tag
  assert.equal(imported.createdAt, 1609459200 * 1000); // original date
});

test('export is browser-compatible with tags + dates (SCN-017)', () => {
  const html = buildNetscape([{ url: 'https://x/y', title: 'T', tags: ['a', 'b'], createdAt: 1609459200000 }]);
  assert.match(html, /NETSCAPE-Bookmark-file-1/);
  assert.match(html, /TAGS="a,b"/);
  assert.match(html, /ADD_DATE="1609459200"/);
});

test('netscape nested folders pop correctly (SCN-017)', () => {
  const html = '<DL><p><DT><H3>Outer</H3><DL><p><DT><A HREF="https://x/1">one</A></DL><p>'
    + '<DT><A HREF="https://x/2">two</A></DL><p>';
  const items = parseNetscape(html);
  const one = items.find(i => i.url === 'https://x/1');
  const two = items.find(i => i.url === 'https://x/2');
  assert.deepEqual(one.tags, ['Outer']);
  assert.deepEqual(two.tags, []); // outside the folder after </DL> pop
});

test('saved searches + prefs persist across sessions (SCN-016, SCN-018)', async () => {
  const dir = tmpDir();
  let store = new Store(dir);
  let s = new Service(store, { capOpts: { fetch: makeFetch({}) } });
  s.addSavedSearch({ name: 'T', query: '#travel', status: 'unread', location: 'active' });
  s.setPrefs({ sort: 'az', pageSize: 50, textSize: 'large' });
  // new session (fresh Store from same dir)
  const store2 = new Store(dir);
  assert.equal(store2.db.savedSearches.length, 1);
  assert.equal(store2.db.savedSearches[0].query, '#travel');
  assert.equal(store2.db.prefs.sort, 'az');
  assert.equal(store2.db.prefs.pageSize, 50);
  assert.equal(store2.db.prefs.textSize, 'large');
});

test('Internet Archive submission recorded on success, errors surfaced (SCN-014)', async () => {
  const okFetch = async (url) => (url.startsWith('https://web.archive.org/save/') ? resp(true, 200, 'ok', 'text/html') : resp(true, 200, '<title>A</title>', 'text/html'));
  const store = new Store(tmpDir());
  const s = new Service(store, { capOpts: { fetch: okFetch } });
  const a = (await s.createBookmark({ url: 'https://ex.com/a' })).bookmark;
  await s.sendToArchive(a.id);
  assert.match(s.store.getBookmark(a.id).preserved.archiveUrl, /web\.archive\.org/);
  // failing archive
  const failFetch = async (url) => (url.startsWith('https://web.archive.org/save/') ? resp(false, 503, '', '') : resp(true, 200, '<title>B</title>', 'text/html'));
  const s2 = new Service(new Store(tmpDir()), { capOpts: { fetch: failFetch } });
  const b = (await s2.createBookmark({ url: 'https://ex.com/b' })).bookmark;
  await assert.rejects(() => s2.sendToArchive(b.id));
});
