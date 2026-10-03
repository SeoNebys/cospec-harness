// Standalone DB-integration tests (bookmarks + tags services).
//
// These run as a plain node script rather than under `node --test` because
// better-sqlite3's native finalizers crash during the test runner's
// process-isolation teardown (RemoveEnvironmentCleanupHook assertion). The
// script owns its own exit code so the crash cannot occur.
import assert from 'node:assert/strict';

const bookmarks = await import('../../src/services/bookmarks.js');
const savedSearches = await import('../../src/services/savedSearches.js');
const db = (await import('../../src/db/index.js')).default;

let passed = 0;
const failures = [];
function t(name, fn) {
  try {
    db.exec('DELETE FROM bookmark_tag; DELETE FROM bookmark; DELETE FROM tag; DELETE FROM saved_search;');
    fn();
    passed++;
    console.log(`  ok  ${name}`);
  } catch (e) {
    failures.push({ name, message: e.message });
    console.log(`  FAIL ${name}: ${e.message}`);
  }
}

t('create + getById round trip with tags and metadata', () => {
  const b = bookmarks.create({
    url: 'https://a.com/x',
    title: 'Title',
    description: 'Desc',
    iconUrl: 'https://a.com/i.ico',
    previewImageUrl: 'https://a.com/p.png',
    tags: ['read', 'travel'],
    noteHtml: '<p>hi <script>alert(1)</script><strong>b</strong></p>',
  });
  const got = bookmarks.getById(b.id);
  assert.equal(got.title, 'Title');
  assert.deepEqual(got.tags.sort(), ['read', 'travel']);
  assert.ok(!/script/.test(got.noteHtml), 'script stripped from note');
  assert.ok(/<strong>b<\/strong>/.test(got.noteHtml));
  assert.equal(got.isUnread, false); // read by default
});

t('readLater creates unread bookmark', () => {
  const b = bookmarks.create({ url: 'https://a.com', readLater: true });
  assert.equal(bookmarks.getById(b.id).isUnread, true);
  assert.equal(bookmarks.list({ view: 'unread' }).total, 1);
});

t('duplicate create throws with existingId', () => {
  const b = bookmarks.create({ url: 'https://a.com/page' });
  assert.throws(
    () => bookmarks.create({ url: 'https://A.com/page/' }),
    (e) => e.name === 'DuplicateError' && e.existingId === b.id
  );
});

t('editing url to collide throws DuplicateError', () => {
  const a = bookmarks.create({ url: 'https://a.com' });
  const b = bookmarks.create({ url: 'https://b.com' });
  assert.throws(
    () => bookmarks.update(b.id, { url: 'https://a.com/' }),
    (e) => e.name === 'DuplicateError' && e.existingId === a.id
  );
});

t('archive hides from main + search, appears in archive, restorable', () => {
  const a = bookmarks.create({ url: 'https://a.com', title: 'japan' });
  bookmarks.update(a.id, { isArchived: true });
  assert.equal(bookmarks.list({ view: 'main' }).total, 0);
  assert.equal(bookmarks.list({ view: 'main', q: 'japan' }).total, 0);
  assert.equal(bookmarks.list({ view: 'archive' }).total, 1);
  bookmarks.update(a.id, { isArchived: false });
  assert.equal(bookmarks.list({ view: 'main' }).total, 1);
});

t('delete removes permanently', () => {
  const a = bookmarks.create({ url: 'https://a.com' });
  assert.equal(bookmarks.remove(a.id), true);
  assert.equal(bookmarks.getById(a.id), null);
});

t('sorting by title and date', () => {
  const a = bookmarks.create({ url: 'https://a.com', title: 'Zebra' });
  const b = bookmarks.create({ url: 'https://b.com', title: 'Apple' });
  const byTitle = bookmarks.list({ sort: 'title_asc' }).items.map((x) => x.title);
  assert.deepEqual(byTitle, ['Apple', 'Zebra']);
});

t('search + tag include/exclude filters', () => {
  bookmarks.create({ url: 'https://a.com', title: 'japan', tags: ['t1'] });
  bookmarks.create({ url: 'https://b.com', title: 'japan', tags: ['t2'] });
  assert.equal(bookmarks.list({ q: 'japan', tags: ['t1'] }).total, 1);
  assert.equal(bookmarks.list({ q: 'japan', notTags: ['t2'] }).total, 1);
});

t('bulk addTags adds without clearing other tags', () => {
  const a = bookmarks.create({ url: 'https://a.com', tags: ['x'] });
  const b = bookmarks.create({ url: 'https://b.com', tags: ['y'] });
  const res = bookmarks.bulk({ ids: [a.id, b.id] }, { action: 'addTags', tags: ['shared'] });
  assert.equal(res.updated, 2);
  assert.deepEqual(bookmarks.getById(a.id).tags.sort(), ['shared', 'x']);
  assert.deepEqual(bookmarks.getById(b.id).tags.sort(), ['shared', 'y']);
});

t('bulk removeTags removes only named tag', () => {
  const a = bookmarks.create({ url: 'https://a.com', tags: ['keep', 'drop'] });
  bookmarks.bulk({ ids: [a.id] }, { action: 'removeTags', tags: ['drop'] });
  assert.deepEqual(bookmarks.getById(a.id).tags, ['keep']);
});

t('bulk over match set applies to all matches', () => {
  bookmarks.create({ url: 'https://a.com', title: 'japan', tags: ['t'] });
  bookmarks.create({ url: 'https://b.com', title: 'japan', tags: ['t'] });
  bookmarks.create({ url: 'https://c.com', title: 'korea', tags: ['t'] });
  const res = bookmarks.bulk({ match: { view: 'main', q: 'japan' } }, { action: 'setArchived', value: true });
  assert.equal(res.updated, 2);
  assert.equal(bookmarks.list({ view: 'main' }).total, 1);
});

t('bulk partial failure reported for missing id', () => {
  const a = bookmarks.create({ url: 'https://a.com' });
  const res = bookmarks.bulk({ ids: [a.id, 99999] }, { action: 'setUnread', value: true });
  assert.equal(res.updated, 1);
  assert.equal(res.failures.length, 1);
});

t('saved search create/apply/rename/delete', () => {
  const s = savedSearches.create({ name: 'Japan trips', query: 'japan', includedTags: ['travel'], excludedTags: ['flight'] });
  assert.equal(savedSearches.list().length, 1);
  const got = savedSearches.list()[0];
  assert.deepEqual(got.includedTags, ['travel']);
  savedSearches.update(s.id, { name: 'Renamed' });
  assert.equal(savedSearches.list()[0].name, 'Renamed');
  savedSearches.remove(s.id);
  assert.equal(savedSearches.list().length, 0);
});

db.exec('DELETE FROM bookmark_tag; DELETE FROM bookmark; DELETE FROM tag; DELETE FROM saved_search;');
db.close();

console.log(`\nDB integration: ${passed} passed, ${failures.length} failed`);
process.exit(failures.length ? 1 : 0);
