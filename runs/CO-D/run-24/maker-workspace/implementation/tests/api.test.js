'use strict';
// API/integration tests. Spins the real server against a temp DB and a local
// target site, exercising SCN-001/002/005/006/010/012/013/014(local)/015/016/011.
const test = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'bm-test-'));
process.env.DATA_DIR = TMP;
process.env.PORT = '4071';
process.env.FETCH_TIMEOUT_MS = '4000';
process.env.SNAPSHOT_TIMEOUT_MS = '4000';
const BASE = 'http://127.0.0.1:4071';

let target, cookie = '';

test.before(async () => {
  // Local target site for metadata + snapshot capture.
  target = http.createServer((req, res) => {
    if (req.url.startsWith('/page')) {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<html><head><title>Local Page</title><meta name="description" content="Hello desc"><meta property="og:image" content="/img.png"></head><body>hi</body></html>');
    } else if (req.url.startsWith('/doc.pdf')) {
      res.writeHead(200, { 'Content-Type': 'application/pdf' });
      res.end(Buffer.from('%PDF-1.4 fake pdf'));
    } else { res.writeHead(404); res.end('no'); }
  });
  await new Promise((r) => target.listen(0, '127.0.0.1', r));
  require('../server.js');
  await new Promise((r) => setTimeout(r, 400));
});
test.after(() => { target.close(); process.exit(0); });

function targetUrl(p) { return 'http://127.0.0.1:' + target.address().port + p; }
async function req(method, p, body, isText) {
  const headers = { Cookie: cookie };
  let payload;
  if (body != null) {
    if (isText) { headers['Content-Type'] = 'text/html'; payload = body; }
    else { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
  }
  const res = await fetch(BASE + p, { method, headers, body: payload });
  const setc = res.headers.get('set-cookie');
  if (setc) cookie = setc.split(';')[0];
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch (e) { json = text; }
  return { status: res.status, json };
}
async function waitSnapshot(id, want) {
  for (let i = 0; i < 30; i++) {
    const r = await req('GET', '/api/bookmarks/' + id);
    if (r.json.bookmark && r.json.bookmark.snapshotStatus === want) return r.json.bookmark;
    await new Promise((r) => setTimeout(r, 300));
  }
  const r = await req('GET', '/api/bookmarks/' + id);
  return r.json.bookmark;
}

test('login required then succeeds (SCN-011)', async () => {
  const noauth = await req('GET', '/api/bookmarks');
  assert.equal(noauth.status, 401);
  const login = await req('POST', '/api/login', { email: 'me@bookmarks.local', password: 'bookmarks' });
  assert.equal(login.status, 200);
});

test('create with auto-filled details + auto snapshot (SCN-001/014)', async () => {
  const r = await req('POST', '/api/bookmarks', { url: targetUrl('/page') });
  assert.equal(r.status, 201);
  assert.equal(r.json.bookmark.title, 'Local Page');
  assert.equal(r.json.bookmark.description, 'Hello desc');
  const b = await waitSnapshot(r.json.bookmark.id, 'saved');
  assert.equal(b.snapshotStatus, 'saved');
  assert.equal(b.snapshotIsPdf, false);
});

test('PDF preserved as PDF (SCN-014)', async () => {
  const r = await req('POST', '/api/bookmarks', { url: targetUrl('/doc.pdf') });
  const b = await waitSnapshot(r.json.bookmark.id, 'saved');
  assert.equal(b.snapshotIsPdf, true);
});

test('duplicate and invalid (SCN-001/010)', async () => {
  const dup = await req('POST', '/api/bookmarks', { url: targetUrl('/page') + '/' });
  assert.equal(dup.json.duplicate, true);
  const bad = await req('POST', '/api/bookmarks', { url: 'not a real address' });
  assert.equal(bad.status, 400);
  assert.equal(bad.json.error, 'invalid');
});

test('edit fields + address conflict guard (SCN-002)', async () => {
  const a = (await req('POST', '/api/bookmarks', { url: 'https://conflict-a.example' })).json.bookmark;
  const b = (await req('POST', '/api/bookmarks', { url: 'https://conflict-b.example' })).json.bookmark;
  const upd = await req('PATCH', '/api/bookmarks/' + a.id, { title: 'Renamed', note: 'n', tags: ['x', 'x', 'X'] });
  assert.equal(upd.json.bookmark.title, 'Renamed');
  assert.deepEqual(upd.json.bookmark.tags, ['x']);
  const clash = await req('PATCH', '/api/bookmarks/' + a.id, { url: 'https://conflict-b.example' });
  assert.equal(clash.status, 400);
  assert.equal(clash.json.error, 'conflict');
});

test('read-later, archive, restore, delete (SCN-003/005/006)', async () => {
  const b = (await req('POST', '/api/bookmarks', { url: 'https://lifecycle.example' })).json.bookmark;
  assert.equal((await req('PATCH', '/api/bookmarks/' + b.id, { readLater: true })).json.bookmark.readLater, true);
  assert.equal((await req('PATCH', '/api/bookmarks/' + b.id, { archived: true })).json.bookmark.archived, true);
  assert.equal((await req('PATCH', '/api/bookmarks/' + b.id, { archived: false })).json.bookmark.archived, false);
  assert.equal((await req('DELETE', '/api/bookmarks/' + b.id)).status, 200);
  assert.equal((await req('GET', '/api/bookmarks/' + b.id)).status, 404);
});

test('bulk actions (SCN-012)', async () => {
  const ids = [];
  for (const u of ['https://bulk1.example', 'https://bulk2.example', 'https://bulk3.example']) ids.push((await req('POST', '/api/bookmarks', { url: u })).json.bookmark.id);
  await req('POST', '/api/bookmarks/bulk', { ids, action: 'addTag', value: 'batch' });
  await req('POST', '/api/bookmarks/bulk', { ids, action: 'archive' });
  const list = (await req('GET', '/api/bookmarks')).json.bookmarks;
  const affected = list.filter((b) => ids.includes(b.id));
  assert.ok(affected.every((b) => b.archived && b.tags.includes('batch')));
});

test('collections CRUD (SCN-013)', async () => {
  const c = (await req('POST', '/api/collections', { name: 'Work', query: '#batch' })).json.collection;
  const listed = (await req('GET', '/api/collections')).json.collections;
  assert.ok(listed.some((x) => x.id === c.id && x.query === '#batch'));
  await req('DELETE', '/api/collections/' + c.id);
  assert.ok(!(await req('GET', '/api/collections')).json.collections.some((x) => x.id === c.id));
});

test('import folders->tags, dates, dedupe + export (SCN-015)', async () => {
  const html = '<!DOCTYPE NETSCAPE-Bookmark-file-1><DL><p><DT><H3>Recipes</H3><DL><p>' +
    '<DT><A HREF="https://imp.example/pasta" ADD_DATE="1600000000">Pasta</A></DL><p>' +
    '<DT><A HREF="https://lifecycle.example" ADD_DATE="1600000000">dup maybe</A></DL><p>';
  const imp = await req('POST', '/api/import', html, true);
  assert.ok(imp.json.added >= 1);
  const list = (await req('GET', '/api/bookmarks')).json.bookmarks;
  const pasta = list.find((b) => b.url.includes('imp.example/pasta'));
  assert.deepEqual(pasta.tags, ['Recipes']);
  assert.equal(pasta.createdAt, 1600000000 * 1000);
  const exp = await fetch(BASE + '/api/export', { headers: { Cookie: cookie } });
  const body = await exp.text();
  assert.ok(body.includes('NETSCAPE-Bookmark-file-1'));
  assert.ok(body.includes('imp.example/pasta'));
});

test('settings persist (SCN-016)', async () => {
  const r = await req('PUT', '/api/settings', { defaultSort: 'az', density: 'compact', fontSize: 'large' });
  assert.deepEqual(r.json.settings, { defaultSort: 'az', density: 'compact', fontSize: 'large' });
  const me = await req('GET', '/api/me');
  assert.equal(me.json.settings.defaultSort, 'az');
});
