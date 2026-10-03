import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startApp, jsonFetch } from './helpers.js';

let app;
before(async () => { app = await startApp(); });
after(async () => { await app.close(); });

const SAMPLE = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<DL><p>
  <DT><A HREF="https://a.com/one">One</A>
  <DT><H3>Tech</H3>
  <DL><p>
    <DT><A HREF="https://b.com/two">Two</A>
    <DT><A HREF="not-a-url">Bad</A>
  </DL><p>
</DL><p>`;

test('POST /api/import adds valid entries, maps folders to tags, reports counts (FR-020/022)', async () => {
  const { status, body } = await jsonFetch(`${app.base}/api/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'text/html' },
    body: SAMPLE,
  });
  assert.equal(status, 200);
  assert.equal(body.imported, 2);
  assert.equal(body.invalid, 1);
  assert.equal(body.skippedDuplicates, 0);

  const list = await jsonFetch(`${app.base}/api/bookmarks?sort=created&order=asc`);
  const two = list.body.bookmarks.find((b) => b.address === 'https://b.com/two');
  assert.deepEqual(two.tags, ['Tech']);
});

test('re-importing the same file skips duplicates (FR-020)', async () => {
  const { body } = await jsonFetch(`${app.base}/api/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'text/html' },
    body: SAMPLE,
  });
  assert.equal(body.imported, 0);
  assert.equal(body.skippedDuplicates, 2);
});

test('GET /api/export returns a Netscape file that re-imports without duplicates (SC-008)', async () => {
  const res = await fetch(`${app.base}/api/export`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /text\/html/);
  const html = await res.text();
  assert.match(html, /NETSCAPE-Bookmark-file-1/);
  assert.match(html, /https:\/\/a\.com\/one/);

  const reimport = await jsonFetch(`${app.base}/api/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'text/html' },
    body: html,
  });
  assert.equal(reimport.body.imported, 0);
  assert.equal(reimport.body.skippedDuplicates, 2);
});
