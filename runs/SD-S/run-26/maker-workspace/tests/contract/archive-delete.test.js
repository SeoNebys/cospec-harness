import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startApp, jsonFetch } from './helpers.js';

let app, id;
before(async () => {
  app = await startApp();
  // Seed one bookmark via import (no capture needed for these state tests).
  await jsonFetch(`${app.base}/api/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'text/html' },
    body: `<DL><p><DT><A HREF="https://example.com/keep">Keep</A></DL><p>`,
  });
  const list = await jsonFetch(`${app.base}/api/bookmarks`);
  id = list.body.bookmarks[0].id;
});
after(async () => { await app.close(); });

test('archive removes from main list and shows in archive; restore returns it (FR-016)', async () => {
  const arch = await jsonFetch(`${app.base}/api/bookmarks/${id}/archive`, { method: 'POST' });
  assert.equal(arch.body.archived, true);

  const main = await jsonFetch(`${app.base}/api/bookmarks?view=all`);
  assert.equal(main.body.count, 0);
  const archiveView = await jsonFetch(`${app.base}/api/bookmarks?view=archive`);
  assert.equal(archiveView.body.count, 1);

  const restored = await jsonFetch(`${app.base}/api/bookmarks/${id}/restore`, { method: 'POST' });
  assert.equal(restored.body.archived, false);
  const mainAgain = await jsonFetch(`${app.base}/api/bookmarks?view=all`);
  assert.equal(mainAgain.body.count, 1);
});

test('read/unread toggle drives the unread view (FR-014)', async () => {
  const unreadBefore = await jsonFetch(`${app.base}/api/bookmarks?view=unread`);
  assert.equal(unreadBefore.body.count, 1);
  await jsonFetch(`${app.base}/api/bookmarks/${id}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'read' }),
  });
  const unreadAfter = await jsonFetch(`${app.base}/api/bookmarks?view=unread`);
  assert.equal(unreadAfter.body.count, 0);
  const all = await jsonFetch(`${app.base}/api/bookmarks?view=all`);
  assert.equal(all.body.count, 1); // still in the full list
});

test('DELETE permanently removes the bookmark (FR-017)', async () => {
  const res = await fetch(`${app.base}/api/bookmarks/${id}`, { method: 'DELETE' });
  assert.equal(res.status, 204);
  const gone = await jsonFetch(`${app.base}/api/bookmarks/${id}`);
  assert.equal(gone.status, 404);
  const all = await jsonFetch(`${app.base}/api/bookmarks?view=all`);
  assert.equal(all.body.count, 0);
});
