import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// A local "origin" website so metadata-fetch and offline-capture work offline.
function startOrigin() {
  const server = http.createServer((req, res) => {
    if (req.url.startsWith('/page')) {
      res.setHeader('content-type', 'text/html');
      res.end('<html><head><title>Real Page Title</title>' +
        '<meta name="description" content="A real description.">' +
        '<meta property="og:image" content="https://img.example/og.png"></head><body>hi</body></html>');
    } else if (req.url.startsWith('/doc.pdf')) {
      res.setHeader('content-type', 'application/pdf');
      res.end(Buffer.from('%PDF-1.4 fake pdf bytes'));
    } else { res.statusCode = 404; res.end('nope'); }
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

let app, origin, baseUrl, originUrl, dataDir;

before(async () => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bm-'));
  process.env.DATA_DIR = dataDir;
  const { createServer } = await import('../../server.js');
  app = await new Promise((resolve) => { const s = createServer().listen(0, '127.0.0.1', () => resolve(s)); });
  baseUrl = `http://127.0.0.1:${app.address().port}`;
  origin = await startOrigin();
  originUrl = `http://127.0.0.1:${origin.address().port}`;
});
after(() => { app.close(); origin.close(); fs.rmSync(dataDir, { recursive: true, force: true }); });

const jget = async (u) => (await fetch(baseUrl + u)).json();
const jpost = (u, b) => fetch(baseUrl + u, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) });

test('fetch-meta reads the real page title/description (SCN-001)', async () => {
  const res = await jpost('/api/fetch-meta', { url: originUrl + '/page' });
  const meta = await res.json();
  assert.equal(meta.failed, false);
  assert.equal(meta.title, 'Real Page Title');
  assert.equal(meta.description, 'A real description.');
  assert.equal(meta.image, 'https://img.example/og.png');
});

test('fetch-meta falls back when unreachable (SCN-011)', async () => {
  const res = await jpost('/api/fetch-meta', { url: 'https://127.0.0.1:1/nope' });
  const meta = await res.json();
  assert.equal(meta.failed, true);
});

test('create + duplicate + edit + delete lifecycle (SCN-001/002/003/007)', async () => {
  let r = await jpost('/api/bookmarks', { url: originUrl + '/page', title: 'Mine', tags: ['x'] });
  assert.equal(r.status, 201);
  const created = await r.json();
  // duplicate
  r = await jpost('/api/bookmarks', { url: originUrl.replace('127.0.0.1', '127.0.0.1') + '/page/', title: 'dup' });
  assert.equal(r.status, 409);
  // edit
  r = await fetch(`${baseUrl}/api/bookmarks/${created.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: 'Renamed', toRead: true }) });
  const edited = await r.json();
  assert.equal(edited.title, 'Renamed');
  assert.equal(edited.toRead, true);
  assert.ok(edited.updatedAt >= created.updatedAt);
  // delete
  r = await fetch(`${baseUrl}/api/bookmarks/${created.id}`, { method: 'DELETE' });
  assert.equal(r.status, 200);
  const state = await jget('/api/state');
  assert.equal(state.bookmarks.some((b) => b.id === created.id), false);
});

test('offline capture: page snapshot and PDF preservation (SCN-016)', async () => {
  const page = await (await jpost('/api/bookmarks', { url: originUrl + '/page', title: 'P' })).json();
  let r = await jpost(`/api/bookmarks/${page.id}/offline`, {});
  assert.equal(r.status, 200);
  let b = await r.json();
  assert.equal(b.offline.type, 'page');
  // open serves the file
  const open = await fetch(`${baseUrl}/api/offline/${page.id}`);
  assert.ok((await open.text()).includes('Real Page Title'));

  const pdf = await (await jpost('/api/bookmarks', { url: originUrl + '/doc.pdf', title: 'Doc' })).json();
  r = await jpost(`/api/bookmarks/${pdf.id}/offline`, {});
  b = await r.json();
  assert.equal(b.offline.type, 'pdf');

  // delete removes the bookmark and its offline copy together
  await fetch(`${baseUrl}/api/bookmarks/${pdf.id}`, { method: 'DELETE' });
  const gone = await fetch(`${baseUrl}/api/offline/${pdf.id}`);
  assert.equal(gone.status, 404);
});

test('offline capture reports failure honestly (SCN-016)', async () => {
  const b = await (await jpost('/api/bookmarks', { url: 'https://127.0.0.1:1/unreachable', title: 'X' })).json();
  const r = await jpost(`/api/bookmarks/${b.id}/offline`, {});
  assert.equal(r.status, 502);
});

test('bulk actions apply to the given ids only (SCN-014)', async () => {
  const a = await (await jpost('/api/bookmarks', { url: 'https://a.example/1', title: 'A' })).json();
  const c = await (await jpost('/api/bookmarks', { url: 'https://c.example/2', title: 'C' })).json();
  await jpost('/api/bulk', { ids: [a.id, c.id], action: 'addTag', value: 'Project X' });
  await jpost('/api/bulk', { ids: [a.id], action: 'toRead', value: true });
  const state = await jget('/api/state');
  const A = state.bookmarks.find((x) => x.id === a.id), C = state.bookmarks.find((x) => x.id === c.id);
  assert.ok(A.tags.includes('project-x') && C.tags.includes('project-x'));
  assert.equal(A.toRead, true);
  assert.equal(C.toRead, false);
  // remove tag only from those that have it
  await jpost('/api/bulk', { ids: [a.id, c.id], action: 'removeTag', value: 'project-x' });
  const state2 = await jget('/api/state');
  assert.ok(!state2.bookmarks.find((x) => x.id === a.id).tags.includes('project-x'));
});

test('import adds, skips duplicates, keeps tags/dates (SCN-017)', async () => {
  const before = (await jget('/api/state')).bookmarks.length;
  const html = `<DL><p>
    <DT><A HREF="https://fresh.example/x" ADD_DATE="1600000000" TAGS="reading,news">Fresh</A>
    <DT><A HREF="https://a.example/1">dup of A</A>
  </DL>`;
  const r = await fetch(`${baseUrl}/api/import`, { method: 'POST', headers: { 'Content-Type': 'text/html' }, body: html });
  const out = await r.json();
  assert.equal(out.added, 1);
  assert.equal(out.skipped, 1);
  const state = await jget('/api/state');
  const fresh = state.bookmarks.find((b) => b.url === 'https://fresh.example/x');
  assert.deepEqual(fresh.tags, ['reading', 'news']);
  assert.equal(fresh.createdAt, 1600000000 * 1000);
  assert.equal(state.bookmarks.length, before + 1);
});

test('import with no bookmarks reports found=0 (SCN-019)', async () => {
  const r = await fetch(`${baseUrl}/api/import`, { method: 'POST', headers: { 'Content-Type': 'text/html' }, body: '<html>no links</html>' });
  const out = await r.json();
  assert.equal(out.added, 0);
  assert.equal(out.found, 0);
});

test('saved-search uniqueness and prefs persistence (SCN-015/018)', async () => {
  let r = await jpost('/api/saved-searches', { name: 'Refs', query: '#reference' });
  assert.equal(r.status, 201);
  r = await jpost('/api/saved-searches', { name: 'refs', query: '#other' });
  assert.equal(r.status, 409);
  await fetch(`${baseUrl}/api/prefs`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ defaultSort: 'title-asc', pageSize: 'all', textSize: 'lg' }) });
  const state = await jget('/api/state');
  assert.equal(state.prefs.defaultSort, 'title-asc');
  assert.equal(state.prefs.pageSize, 'all');
  assert.equal(state.prefs.textSize, 'lg');
});

test('archive submission is manual and returns a snapshot link (SCN-016)', async () => {
  const b = await (await jpost('/api/bookmarks', { url: 'https://archive-me.example/p', title: 'AM' })).json();
  assert.equal(b.archiveUrl, null); // not automatic on save
  const r = await jpost(`/api/bookmarks/${b.id}/archive`, {});
  const out = await r.json();
  assert.match(out.bookmark.archiveUrl, /web\.archive\.org/);
});

test('data persists across store reloads (durability)', async () => {
  const { Store } = await import('../../src/store.js');
  const reloaded = new Store(dataDir);
  assert.ok(reloaded.bookmarks.length > 0);
});
