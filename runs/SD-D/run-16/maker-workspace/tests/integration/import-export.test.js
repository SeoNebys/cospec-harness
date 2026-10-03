import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { useTempData } from '../helpers/seed.js';

let app;
let svc;
let temp;

before(async () => {
  temp = useTempData();
  svc = await import('../../src/server/services/bookmarks.js');
  app = (await import('../../src/server/app.js')).createApp();
});
after(() => temp.cleanup());

const FILE = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<DL><p>
  <DT><A HREF="https://imp1.example/" ADD_DATE="1600000000" TAGS="imported,news">Imported One</A>
  <DT><A HREF="https://imp2.example/">Imported Two</A>
</DL><p>`;

test('import adds new bookmarks preserving title, tags, and date-added', async () => {
  const res = await request(app).post('/api/import').set('Content-Type', 'text/html').send(FILE);
  assert.equal(res.status, 200);
  assert.equal(res.body.added, 2);
  assert.equal(res.body.skipped, 0);

  const one = svc.getBookmarkByAddress('https://imp1.example/');
  assert.equal(one.title, 'Imported One');
  assert.deepEqual(one.tags.sort(), ['imported', 'news']);
  assert.equal(one.dateAdded, new Date(1600000000 * 1000).toISOString());
});

test('re-import skips existing addresses and reports counts', async () => {
  const res = await request(app).post('/api/import').set('Content-Type', 'text/html').send(FILE);
  assert.equal(res.body.added, 0);
  assert.equal(res.body.skipped, 2);
});

test('malformed import returns 400', async () => {
  const res = await request(app).post('/api/import').set('Content-Type', 'text/html').send('not a bookmark file at all');
  assert.equal(res.status, 400);
});

test('export produces a Netscape bookmark file containing saved bookmarks', async () => {
  const res = await request(app).get('/api/export');
  assert.equal(res.status, 200);
  assert.match(res.headers['content-type'], /text\/html/);
  assert.match(res.text, /NETSCAPE-Bookmark-file-1/);
  assert.match(res.text, /https:\/\/imp1\.example\//);
  assert.match(res.text, /TAGS="imported,news"/);
});
