// Phase 3 verification: exercise the REAL storage + logic modules together
// (via a minimal in-memory IndexedDB) so integration faults surface, not just
// unit behaviour. Covers the Given/When/Then of the approved scenarios end-to-end.

import { test } from 'node:test';
import assert from 'node:assert/strict';

// --- minimal in-memory IndexedDB, persistent per db-name across open() calls ---
const DBS = {};
function fireAsync(req) { queueMicrotask(() => { if (req.onsuccess) req.onsuccess({ target: req }); }); }
function makeStore(def) { return { keyPath: def.keyPath, auto: !!def.autoIncrement, seq: 0, map: new Map(), indexes: new Set() }; }
class FakeObjStore {
  constructor(store) { this.store = store; }
  put(val) { const s = this.store; let key = val[s.keyPath];
    if (key == null && s.auto) { key = ++s.seq; val = { ...val, [s.keyPath]: key }; }
    else if (typeof key === 'number' && key > s.seq) s.seq = key;
    s.map.set(key, val); const r = { result: key }; fireAsync(r); return r; }
  get(key) { const r = { result: this.store.map.get(key) }; fireAsync(r); return r; }
  getAll() { const r = { result: [...this.store.map.values()] }; fireAsync(r); return r; }
  delete(key) { this.store.map.delete(key); const r = { result: undefined }; fireAsync(r); return r; }
  createIndex(name) { this.store.indexes.add(name); }
}
class FakeTx { constructor(db) { this.db = db; } objectStore(name) { return new FakeObjStore(this.db.stores[name]); } }
class FakeDB {
  constructor(name) { this.name = name; this.stores = {}; this.objectStoreNames = { contains: (n) => n in this.stores }; }
  createObjectStore(name, def) { this.stores[name] = makeStore(def); const os = new FakeObjStore(this.stores[name]); return os; }
  transaction(_names, _mode) { return new FakeTx(this); }
}
global.indexedDB = {
  open(name, version) {
    const req = { result: null, onupgradeneeded: null, onsuccess: null, onerror: null };
    const existing = DBS[name];
    const db = existing || new FakeDB(name);
    DBS[name] = db;
    queueMicrotask(() => {
      req.result = db;
      if (!existing && req.onupgradeneeded) req.onupgradeneeded({ target: req });
      if (req.onsuccess) req.onsuccess({ target: req });
    });
    return req;
  },
};

// import AFTER the shim is in place
const db = await import('../extension/src/db.js');
const { makeLink, normalizeUrl, addTag, sanitizeNote, findDuplicate, findDuplicateElsewhere } = await import('../extension/src/core.js');
const { poolForView, unreadCount, matchesQuery, sortLinks, savedViewKey } = await import('../extension/src/query.js');
const { parseBookmarksHtml, importDate, buildNetscapeHtml } = await import('../extension/src/porting.js');

test('VERIFY SCN-001/003: save, no duplicate, newest-first through real DB', async () => {
  const a = await db.putLink(makeLink('https://example.com/a', { ok: true, title: 'A' }, 100));
  const b = await db.putLink(makeLink('example.com/b', { ok: true, title: 'B' }, 200));
  assert.ok(a && b && a !== b);
  const links = await db.allLinks();
  assert.equal(links.length, 2);
  // duplicate check the way save() does it
  assert.ok(await db.findByNorm(normalizeUrl('HTTP://WWW.example.com/a/')));
  const newestFirst = sortLinks(links, 'new').map((l) => l.title);
  assert.deepEqual(newestFirst, ['B', 'A']);
});

test('VERIFY SCN-005/006/007/019: edit updates in place; tags/note persisted', async () => {
  const links = await db.allLinks();
  const l = links.find((x) => x.title === 'A');
  l.title = 'Alpha'; l.tags = addTag(l.tags || [], 'Recipes'); l.note = sanitizeNote('<p>hi <b>x</b><i>no</i></p>');
  await db.putLink(l);
  const after = (await db.allLinks()).find((x) => x.id === l.id);
  assert.equal(after.title, 'Alpha');
  assert.deepEqual(after.tags, ['recipes']);
  assert.ok(after.note.includes('<b>x</b>') && !/<i>/.test(after.note));
  assert.equal((await db.allLinks()).length, 2); // edit didn't add a row
});

test('VERIFY SCN-003 back-door: edit into an existing address is caught', async () => {
  const links = await db.allLinks();
  const b = links.find((x) => x.title === 'B');
  assert.ok(findDuplicateElsewhere(links, b.id, 'https://example.com/a')); // clashes with Alpha
  assert.equal(findDuplicateElsewhere(links, b.id, 'https://fresh.com/x'), null);
});

test('VERIFY SCN-010/011/013: read-later + shelf pools through real DB', async () => {
  const links = await db.allLinks();
  const a = links.find((x) => x.title === 'Alpha'); a.status = 'unread'; await db.putLink(a);
  const b = links.find((x) => x.title === 'B'); b.status = 'unread'; b.aside = true; await db.putLink(b);
  const all = await db.allLinks();
  assert.deepEqual(poolForView(all, 'toread').map((l) => l.title), ['Alpha']); // b shelved -> not in pile
  assert.deepEqual(poolForView(all, 'aside').map((l) => l.title), ['B']);
  assert.equal(unreadCount(all), 1);
  // shelved link excluded from everyday search too
  assert.ok(!poolForView(all, 'all').some((l) => l.title === 'B'));
});

test('VERIFY SCN-016/017: copy stored, stamped on link, gone on delete, back on undo', async () => {
  const l = (await db.allLinks()).find((x) => x.title === 'Alpha');
  await db.putCopy({ linkId: l.id, kind: 'reader', title: 'Alpha', html: '<p>body</p>', partial: false, capturedAt: 5 });
  l.copy = { kind: 'reader', partial: false, capturedAt: 5 }; await db.putLink(l);
  assert.ok((await db.getCopy(l.id)).html.includes('body'));
  assert.equal((await db.allCopies()).length, 1);
  // delete takes the copy; undo restores link (same id) + would re-capture
  const snapshot = { ...l };
  await db.deleteLink(l.id); await db.deleteCopy(l.id);
  assert.ok(!(await db.getCopy(l.id))); // copy gone (getCopy yields null when absent)
  await db.putLink(snapshot); // undo
  assert.ok((await db.allLinks()).some((x) => x.id === l.id));
});

test('VERIFY SCN-015: import keeps original dates, skips dupes; export round-trips', async () => {
  const BM = `<DL><p><DT><H3>Old</H3><DL><p>
    <DT><A HREF="https://example.com/a" ADD_DATE="1500000000">dup of Alpha</A>
    <DT><A HREF="https://ancient.example.com/2016" ADD_DATE="1460000000">Ancient</A>
  </DL><p></DL><p>`;
  const parsed = parseBookmarksHtml(BM);
  const existing = new Set((await db.allLinks()).map((l) => normalizeUrl(l.url)));
  const fresh = parsed.filter((p) => !existing.has(normalizeUrl(p.url)));
  assert.equal(fresh.length, 1); // the example.com/a dup is skipped
  const now = 9_999_999_999_999;
  for (const p of fresh) { const rec = makeLink(p.url, { ok: true, title: p.title }, importDate(p.addDate, now)); rec.tags = addTag([], p.folder); await db.putLink(rec); }
  const ancient = (await db.allLinks()).find((l) => l.title === 'Ancient');
  assert.equal(ancient.savedAt, 1460000000 * 1000);        // real 2016 date kept
  assert.deepEqual(ancient.tags, ['old']);                  // folder -> label
  // the 2016 import is older than a link saved "today" -> lands earlier in Oldest-first
  const twoLinks = sortLinks([ancient, { title: 'today', savedAt: now }], 'old');
  assert.equal(twoLinks[0].title, 'Ancient');
  // export → re-import keeps the url+date
  const re = parseBookmarksHtml(buildNetscapeHtml(await db.allLinks()));
  assert.ok(re.find((r) => r.url.includes('ancient') && r.addDate === 1460000000 * 1000));
});

test('VERIFY SCN-020: saved views persist and identify by lens+topics+search', async () => {
  await db.putSearch({ name: 'Work to read', view: 'toread', topics: { inc: ['work'], exc: [] }, q: '' });
  const s = (await db.allSearches())[0];
  assert.equal(s.name, 'Work to read');
  assert.equal(savedViewKey(s.view, s.topics.inc, s.topics.exc, s.q), savedViewKey('toread', ['work'], [], ''));
});

test('VERIFY SCN-009: search composes with the real records (accent-fold + fields)', async () => {
  await db.putLink(makeLink('https://cafe.example.com/x', { ok: true, title: 'Le Café' }, 300));
  const links = await db.allLinks();
  const hit = links.filter((l) => matchesQuery(l, 'cafe'));
  assert.ok(hit.some((l) => l.title === 'Le Café')); // "cafe" finds "Café"
});
