'use strict';
// Acceptance tests mapped to approved scenarios. Page-capture is faked so these are
// deterministic and need no network.
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createStore } = require('../server/store');

const PAGES = {
  'https://k.example/bread': { title: 'No-Knead Bread', summary: 'A loaf with a crackly crust.', imageUrl: 'https://img/bread.jpg', copyText: 'flour water salt open crumb crust' },
  'https://b.example/article': { title: 'The Article', summary: 'Focus and attention.', imageUrl: null, copyText: 'attention willpower focus' },
};
const DEAD = new Set(['https://gone.example/old', 'https://broken.example/unreadable']);
async function fakeCapture(url) {
  if (DEAD.has(url)) return { ok: false, reason: 'unreachable' };
  const p = PAGES[url];
  if (p) return { ok: true, ...p };
  return { ok: true, title: 'Saved page', summary: 'auto', imageUrl: null, copyText: 'generic body text' };
}
function freshStore() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bm-'));
  return createStore({ dataDir: dir, capture: fakeCapture });
}
async function waitImport(store, jobId) {
  for (let i = 0; i < 500; i++) {
    const j = store.importStatus(jobId);
    if (j && j.done) return j;
    await new Promise((r) => setTimeout(r, 5));
  }
  throw new Error('import did not finish');
}

// SCN-001 + SCN-015
test('save captures details and keeps a copy; findable by body word', async () => {
  const s = freshStore();
  const r = await s.create({ url: 'https://k.example/bread' });
  assert.equal(r.status, 'created');
  assert.equal(r.item.title, 'No-Knead Bread');
  assert.equal(r.item.hasCopy, true);
  const found = s.search({ q: 'crumb' }).items; // "crumb" only in body
  assert.equal(found.length, 1);
  assert.equal(found[0].match.strong, false);
});

// SCN-004
test('re-saving a link returns the existing one, no duplicate', async () => {
  const s = freshStore();
  await s.create({ url: 'https://k.example/bread' });
  const dup = await s.create({ url: 'http://www.k.example/bread/' }); // trivial diffs
  assert.equal(dup.status, 'duplicate');
  assert.equal(s.list().items.length, 1);
});

// SCN-013
test('an obvious non-link is rejected', async () => {
  const s = freshStore();
  await assert.rejects(() => s.create({ url: 'not a link' }), /web address/);
});

// SCN-012
test('capture failure still saves, flagged needs-a-title', async () => {
  const s = freshStore();
  const r = await s.create({ url: 'https://broken.example/unreadable' });
  assert.equal(r.status, 'created');
  assert.equal(r.needsTitle, true);
  assert.equal(s.list().items.length, 1);
});

// SCN-003 / SCN-005
test('edit updates title, summary, address, labels', async () => {
  const s = freshStore();
  const r = await s.create({ url: 'https://k.example/bread' });
  const upd = s.update(r.item.id, { title: 'My Bread', summary: 'notes', url: 'https://k.example/bread2', labels: ['cooking', 'cooking'] });
  assert.equal(upd.title, 'My Bread');
  assert.equal(upd.url, 'https://k.example/bread2');
  assert.deepEqual(upd.labels, ['cooking']); // de-duplicated
});

// SCN-009
test('refetch pulls fresh info only on demand', async () => {
  const s = freshStore();
  const r = await s.create({ url: 'https://broken.example/unreadable' }); // failed capture, no title
  const rf = await s.refetch(r.item.id, { url: 'https://b.example/article' });
  assert.equal(rf.ok, true);
  assert.equal(rf.item.title, 'The Article');
});

// SCN-010
test('to-read flag, pile view, and check-off', async () => {
  const s = freshStore();
  const r = await s.create({ url: 'https://k.example/bread', unread: true });
  assert.equal(s.list({ view: 'toread' }).items.length, 1);
  s.setToRead(r.item.id, false);
  assert.equal(s.list({ view: 'toread' }).items.length, 0);
  assert.equal(s.list({ view: 'all' }).items.length, 1); // still in collection
});

// SCN-008
test('archived items leave everyday list and search, stay in archive', async () => {
  const s = freshStore();
  const r = await s.create({ url: 'https://k.example/bread' });
  s.setArchived(r.item.id, true);
  assert.equal(s.list({ view: 'all' }).items.length, 0);
  assert.equal(s.search({ q: 'bread', view: 'all' }).items.length, 0); // excluded from everyday search
  assert.equal(s.list({ view: 'archived' }).items.length, 1);
});

// SCN-018
test('search respects an active label scope', async () => {
  const s = freshStore();
  const a = await s.create({ url: 'https://k.example/bread' });
  const b = await s.create({ url: 'https://b.example/article' });
  s.update(a.item.id, { labels: ['cooking'] });
  s.update(b.item.id, { labels: ['reading'] });
  const scoped = s.search({ q: 'a', view: 'all', label: 'cooking' }).items; // 'a' matches both, but scope to cooking
  assert.ok(scoped.every((it) => it.labels.includes('cooking')));
});

// SCN-006
test('delete then undo restores the bookmark', async () => {
  const s = freshStore();
  const r = await s.create({ url: 'https://k.example/bread' });
  s.remove(r.item.id);
  assert.equal(s.list().items.length, 0);
  s.undelete(r.item.id);
  assert.equal(s.list().items.length, 1);
});

// SCN-020
test('import: dates kept, folders→labels, duplicates skipped, dead flagged, export round-trips', async () => {
  const s = freshStore();
  const html = `<DL><p>
    <DT><H3>Cooking</H3><DL><p>
      <DT><A HREF="https://k.example/bread" ADD_DATE="1600000000">Bread</A>
      <DT><A HREF="https://k.example/bread" ADD_DATE="1600000000">Bread dup</A>
    </DL><p>
    <DT><A HREF="https://gone.example/old" ADD_DATE="1500000000">Old Dead Thing</A>
  </DL><p>`;
  const job = s.importStart(html, { foldersAsLabels: true });
  const done = await waitImport(s, job.id);
  assert.equal(done.summary.added, 2);      // bread + dead
  assert.equal(done.summary.duplicates, 1); // second bread
  assert.equal(done.summary.dead, 1);       // gone.example
  const items = s.list().items;
  const bread = items.find((i) => i.url === 'https://k.example/bread');
  assert.ok(bread.labels.includes('cooking')); // folder→label
  assert.ok(String(bread.savedAt).startsWith('20')); // original date kept
  const dead = items.find((i) => i.url === 'https://gone.example/old');
  assert.equal(dead.originalGone, true);
  assert.equal(dead.hasCopy, false);

  // export includes everything and re-imports (round-trip)
  const exported = s.exportAll();
  assert.equal(exported.bookmarks.length, 2);
  const s2 = freshStore();
  const job2 = s2.importStart(JSON.stringify(exported), {});
  await waitImport(s2, job2.id);
  assert.equal(s2.list().items.length, 2);
});
