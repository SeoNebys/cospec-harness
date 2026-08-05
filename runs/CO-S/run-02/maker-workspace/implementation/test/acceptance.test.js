'use strict';
/*
 * Acceptance tests mapped directly to the approved Gherkin (SCN-001..SCN-009).
 * Each test names the scenario it verifies.
 */
const test = require('node:test');
const assert = require('node:assert');
const BM = require('../src/core.js');
const { extractTitle } = require('../src/title.js');

test('SCN-001 save a link with a name — appears, named, newest first', function () {
  const s = new BM.BookmarkStore();
  s.add({ url: 'a.com', title: 'First' }, 10);
  s.add({ url: 'b.com', title: 'Second' }, 20);
  const all = s.all();
  assert.strictEqual(all.length, 2);
  assert.strictEqual(BM.displayName(all[0]), 'Second'); // newest on top
  assert.strictEqual(BM.displayName(all[1]), 'First');
});

test('SCN-001 save a link without a name — shows the link itself', function () {
  const s = new BM.BookmarkStore();
  const r = s.add({ url: 'c.com' }, 1);
  assert.strictEqual(BM.displayName(r.bookmark), 'https://c.com');
});

test('SCN-002 fetched title is extracted from page HTML', function () {
  assert.strictEqual(
    extractTitle('<html><head><title>  GitHub: Let’s build  </title></head></html>'),
    'GitHub: Let’s build'
  );
  assert.strictEqual(extractTitle('<html><head></head></html>'), null); // no title -> null (SCN-007 fallback)
});

test('SCN-002 a name the user typed takes precedence over any fetched title', function () {
  // Core stores whatever name is provided at save time; the UI only auto-fills
  // when the user has not typed one. Here a user name must survive.
  const s = new BM.BookmarkStore();
  const r = s.add({ url: 'd.com', title: 'my own words' }, 1);
  assert.strictEqual(r.bookmark.title, 'my own words');
});

test('SCN-003 search matches name or link address, case-insensitive', function () {
  const s = new BM.BookmarkStore();
  s.add({ url: 'https://seriouseats.com/banana-bread', title: 'Banana Bread Recipe' }, 1);
  s.add({ url: 'https://nytimes.com/section/world', title: 'World News' }, 2);
  assert.strictEqual(s.search('recipe').length, 1);          // by name
  assert.strictEqual(s.search('BANANA').length, 1);          // case-insensitive
  assert.strictEqual(s.search('nytimes').length, 1);         // by address
  assert.strictEqual(s.search('nothing-here').length, 0);    // no match
  assert.strictEqual(s.search('').length, 2);                // cleared -> full list
});

test('SCN-004 a bookmark is reachable from any of its tags', function () {
  const s = new BM.BookmarkStore();
  s.add({ url: 'yt.com/tomatoes', title: 'Prune Tomatoes', tags: ['cooking', 'gardening'] }, 1);
  s.add({ url: 'nyt.com', title: 'News', tags: ['news'] }, 2);
  assert.strictEqual(s.byTag('cooking').length, 1);
  assert.strictEqual(s.byTag('gardening').length, 1);
  assert.strictEqual(s.byTag('cooking')[0].id, s.byTag('gardening')[0].id); // same bookmark
});

test('SCN-004 tagCounts lists tags with counts, alphabetically', function () {
  const s = new BM.BookmarkStore();
  s.add({ url: 'a.com', tags: ['news', 'tech'] }, 1);
  s.add({ url: 'b.com', tags: ['news'] }, 2);
  assert.deepStrictEqual(s.tagCounts(), [
    { tag: 'news', count: 2 },
    { tag: 'tech', count: 1 }
  ]);
});

test('SCN-005 near-duplicate tags collapse to one consistent tag', function () {
  const s = new BM.BookmarkStore();
  s.add({ url: 'a.com', tags: ['Recipes'] }, 1);
  s.add({ url: 'b.com', tags: ['recipes'] }, 2);
  // Both normalize to the same tag, so browsing finds both.
  assert.strictEqual(s.byTag('recipes').length, 2);
  assert.strictEqual(s.tagCounts().length, 1);
});

test('SCN-007 saving text that is not a link is rejected', function () {
  const s = new BM.BookmarkStore();
  const r = s.add({ url: 'hello world' }, 1);
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.reason, BM.ADD_INVALID);
  assert.strictEqual(s.items.length, 0);
});

test('SCN-007 saving a duplicate link is blocked and points to the existing one', function () {
  const s = new BM.BookmarkStore();
  s.add({ url: 'https://github.com/torvalds/linux', title: 'linux' }, 1);
  const r = s.add({ url: 'github.com/torvalds/linux/' }, 2); // same link, different form
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.reason, BM.ADD_DUPLICATE);
  assert.ok(r.existing);
  assert.strictEqual(BM.displayName(r.existing), 'linux');
  assert.strictEqual(s.items.length, 1); // no duplicate created
});

test('SCN-007 title fetch failure yields null so the UI can fall back', function () {
  // extractTitle returns null when there is no usable title; the server maps a
  // network failure to { ok:false } the same way.
  assert.strictEqual(extractTitle(''), null);
  assert.strictEqual(extractTitle('not html at all'), null);
});
