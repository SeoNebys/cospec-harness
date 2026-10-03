import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startApp, jsonFetch } from './helpers.js';

let app;
before(async () => {
  app = await startApp();
  // Seed via import (fast; no network capture).
  const html = `<DL><p>
    <DT><H3>Work</H3>
    <DL><p>
      <DT><A HREF="https://alpha.example.com/report">Alpha Report</A>
      <DT><A HREF="https://beta.example.com/notes">Beta Notes</A>
    </DL><p>
    <DT><A HREF="https://gamma.example.com/misc">Gamma Misc</A>
  </DL><p>`;
  await jsonFetch(`${app.base}/api/import`, {
    method: 'POST', headers: { 'Content-Type': 'text/html' }, body: html,
  });
});
after(async () => { await app.close(); });

test('keyword search matches title/address/tags (FR-011)', async () => {
  const byTitle = await jsonFetch(`${app.base}/api/bookmarks?q=alpha`);
  assert.equal(byTitle.body.count, 1);
  assert.equal(byTitle.body.bookmarks[0].address, 'https://alpha.example.com/report');

  const byTag = await jsonFetch(`${app.base}/api/bookmarks?q=work`);
  assert.equal(byTag.body.count, 2); // Alpha + Beta carry the Work tag
});

test('tag filter narrows results (FR-012)', async () => {
  const res = await jsonFetch(`${app.base}/api/bookmarks?tag=Work`);
  assert.equal(res.body.count, 2);
});

test('sort by title asc/desc reorders (FR-013)', async () => {
  const asc = await jsonFetch(`${app.base}/api/bookmarks?sort=title&order=asc`);
  const titles = asc.body.bookmarks.map((b) => b.title);
  assert.deepEqual(titles, ['Alpha Report', 'Beta Notes', 'Gamma Misc']);

  const desc = await jsonFetch(`${app.base}/api/bookmarks?sort=title&order=desc`);
  assert.deepEqual(desc.body.bookmarks.map((b) => b.title), ['Gamma Misc', 'Beta Notes', 'Alpha Report']);
});

test('no-match search returns an empty list (FR-023)', async () => {
  const res = await jsonFetch(`${app.base}/api/bookmarks?q=zzzznope`);
  assert.equal(res.body.count, 0);
  assert.deepEqual(res.body.bookmarks, []);
});
