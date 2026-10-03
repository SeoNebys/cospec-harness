'use strict';
const test = require('node:test');
const assert = require('node:assert');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');

// Isolated DB for this test file.
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bm-test-'));
process.env.BOOKMARKS_DATA_DIR = dir;
process.env.BOOKMARKS_DB = path.join(dir, 'test.db');
const repo = require('../src/repo');

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

test('create then duplicate save returns existing, no second row (SCN-006)', () => {
  const a = repo.createBookmark({ url: 'https://www.example.com/one/', title: 'One', tags: ['x'] });
  assert.ok(a.created);
  const dup = repo.createBookmark({ url: 'http://example.com/one?utm_source=z#f', title: 'Dup' });
  assert.ok(dup.duplicate);
  assert.strictEqual(dup.bookmark.id, a.bookmark.id);
});

test('update bumps updated_at and edits tags/note/status (SCN-002/004)', async () => {
  const c = repo.createBookmark({ url: 'https://example.com/upd', title: 'T' }).bookmark;
  await sleep(5);
  const u = repo.updateBookmark(c.id, { note: 'hi **bold**', tags: ['a', 'b'], status: 'finished' });
  assert.strictEqual(u.note, 'hi **bold**');
  assert.deepStrictEqual(u.tags, ['a', 'b']);
  assert.strictEqual(u.status, 'finished');
  assert.ok(u.updated_at > c.updated_at);
});

test('list applies query, status, archived scope and pagination (SCN-003/004/009)', () => {
  // fresh set with known created_at ordering
  repo.createBookmark({ url: 'https://s.com/a', title: 'Alpha reading', tags: ['reading'], created_at: 1000 });
  repo.createBookmark({ url: 'https://s.com/b', title: 'Beta reading', tags: ['reading', 'focus'], created_at: 2000 });
  repo.createBookmark({ url: 'https://s.com/c', title: 'Gamma cooking', tags: ['recipes'], created_at: 3000 });
  const r1 = repo.listBookmarks({ query: '#reading', status: 'all', archived: false, sort: 'newest', offset: 0, limit: 50 });
  assert.strictEqual(r1.total, 2);
  assert.deepStrictEqual(r1.items.map(b => b.title), ['Beta reading', 'Alpha reading']);
  // pagination
  const r2 = repo.listBookmarks({ query: '#reading', status: 'all', archived: false, sort: 'newest', offset: 1, limit: 1 });
  assert.strictEqual(r2.total, 2);
  assert.strictEqual(r2.items.length, 1);
  assert.strictEqual(r2.items[0].title, 'Alpha reading');
});

test('sort orders (SCN-010)', () => {
  const oldest = repo.listBookmarks({ query: '#reading', archived: false, sort: 'oldest', offset: 0, limit: 50 });
  assert.deepStrictEqual(oldest.items.map(b => b.title), ['Alpha reading', 'Beta reading']);
  const az = repo.listBookmarks({ query: '', archived: false, sort: 'az', offset: 0, limit: 50 });
  const titles = az.items.map(b => b.title);
  assert.deepStrictEqual(titles, [...titles].sort((a, b) => a.localeCompare(b)));
});

test('archived items leave main scope; restore returns them (SCN-005)', () => {
  const b = repo.createBookmark({ url: 'https://s.com/arch', title: 'Archive me', status: 'finished' }).bookmark;
  repo.updateBookmark(b.id, { archived: true });
  const main = repo.listBookmarks({ query: '', status: 'all', archived: false, sort: 'newest', limit: 100 });
  assert.ok(!main.items.find(x => x.id === b.id));
  const arch = repo.listBookmarks({ query: '', archived: true, sort: 'newest', limit: 100 });
  assert.ok(arch.items.find(x => x.id === b.id));
  repo.updateBookmark(b.id, { archived: false });
  const main2 = repo.listBookmarks({ query: '', status: 'finished', archived: false, sort: 'newest', limit: 100 });
  assert.ok(main2.items.find(x => x.id === b.id));
});

test('select-all-matching + bulk actions (SCN-012)', () => {
  const ids = repo.matchingIds({ query: '#reading', status: 'all', archived: false, sort: 'newest' });
  assert.ok(ids.length >= 2);
  const r = repo.bulk('markRead', { match: { query: '#reading', status: 'all', archived: false } });
  assert.strictEqual(r.affected, ids.length);
  for (const id of ids) assert.strictEqual(repo.getBookmark(id).status, 'finished');
  repo.bulk('addTags', { ids }, { tags: ['batch'] });
  for (const id of ids) assert.ok(repo.getBookmark(id).tags.includes('batch'));
});

test('collections build a live query (SCN-014)', () => {
  const col = repo.saveCollection({ name: 'Reading no focus', text: '', inc: ['reading'], exc: ['focus'] });
  const q = repo.collectionQuery({ text: '', inc: ['reading'], exc: ['focus'] });
  const res = repo.listBookmarks({ query: q, status: 'all', archived: false, sort: 'newest', limit: 100 });
  assert.ok(res.items.every(b => b.tags.includes('reading') && !b.tags.includes('focus')));
  assert.ok(repo.listCollections().find(c => c.name === 'Reading no focus'));
});

test('import dedups and export round-trips extras (SCN-015)', () => {
  const { buildBookmarksHtml, parseBookmarksHtml } = require('../src/lib/bookmarksHtml');
  const html = buildBookmarksHtml([
    { url: 'https://s.com/a', title: 'dup existing', created_at: 1000, tags: [] }, // already exists
    { url: 'https://new.example.com/z', title: 'Fresh', created_at: 1710000000000, tags: ['imported'], note: 'n', status: 'finished' }
  ]);
  const { records } = parseBookmarksHtml(html, { folderTags: false });
  const result = repo.importRecords(records, { addToRead: false });
  assert.strictEqual(result.imported, 1);
  assert.strictEqual(result.existed, 1);
  const fresh = repo.findByKey(require('../src/lib/normalize').normalizeKey('https://new.example.com/z'));
  assert.strictEqual(fresh.note, 'n');
  assert.strictEqual(fresh.status, 'finished');
  assert.strictEqual(fresh.created_at, 1710000000000);
});

test('preferences persist (SCN-016)', () => {
  repo.setPreferences({ text_size: 'large', density: 'compact', per_load: 100, default_sort: 'az' });
  const p = repo.getPreferences();
  assert.strictEqual(p.text_size, 'large');
  assert.strictEqual(p.density, 'compact');
  assert.strictEqual(p.per_load, 100);
  assert.strictEqual(p.default_sort, 'az');
});

test.after(() => { try { fs.rmSync(dir, { recursive: true, force: true }); } catch {} });
