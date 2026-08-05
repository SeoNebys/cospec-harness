'use strict';
/*
 * Acceptance tests mapped to approved scenarios (SCN-001..SCN-012), plus unit
 * coverage of core logic. Pure-logic level — DOM/persistence wiring is thin and
 * exercised manually in Phase 3 verification.
 */
const test = require('node:test');
const assert = require('node:assert');
const C = require('../core.js');

let seq = 0;
function id() { seq += 1; return 'id' + seq; }

// Build an items array newest-first, like the app does (unshift on save).
function build(specs) {
  const items = [];
  specs.forEach(function (s) {
    items.unshift(C.makeBookmark(s.url, s.groups || [], id()));
  });
  return items;
}

// --- SCN-001: Save a link into the one place --------------------------------
test('SCN-001 saved link keeps its url and gets a readable title', function () {
  const items = build([{ url: 'nytimes.com/2026/some-great-recipe' }]);
  const bm = items[0];
  assert.match(bm.url, /^https:\/\/nytimes\.com\/2026\/some-great-recipe$/);
  assert.ok(bm.title.length > 0, 'title is produced automatically');
  assert.match(bm.title, /nytimes\.com$/, 'title references the source host');
  assert.match(bm.title, /Some Great Recipe/, 'title is human-readable from the path');
});

test('SCN-001 newest saved link appears first', function () {
  const items = build([{ url: 'a.com' }, { url: 'b.com' }, { url: 'c.com' }]);
  assert.deepStrictEqual(items.map(function (i) { return i.url; }),
    ['https://c.com/', 'https://b.com/', 'https://a.com/']);
});

// --- SCN-002: Put a link into one or more groups ----------------------------
test('SCN-002 a link can belong to multiple groups', function () {
  const items = build([{ url: 'example.com/pasta', groups: ['Recipes', 'Read later'] }]);
  assert.deepStrictEqual(items[0].groups, ['Recipes', 'Read later']);
});

test('SCN-002 a link may be saved with no group', function () {
  const items = build([{ url: 'example.com' }]);
  assert.deepStrictEqual(items[0].groups, []);
});

test('SCN-002 duplicate group names on one link are collapsed', function () {
  const items = build([{ url: 'example.com', groups: ['Work', 'work', ' Work '] }]);
  assert.deepStrictEqual(items[0].groups, ['Work']);
});

// --- SCN-003: Browse saved links by group -----------------------------------
test('SCN-003 browsing a group shows only its links; All shows everything', function () {
  const items = build([
    { url: 'w.com', groups: ['Work'] },
    { url: 'r.com', groups: ['Recipes'] },
    { url: 'p.com', groups: ['Recipes', 'Read later'] }
  ]);
  assert.strictEqual(C.inGroup(items, 'Recipes').length, 2);
  assert.strictEqual(C.inGroup(items, 'Work').length, 1);
  assert.strictEqual(C.inGroup(items, 'All').length, 3);
});

test('SCN-003 a multi-group link appears under each of its groups', function () {
  const items = build([{ url: 'p.com', groups: ['Recipes', 'Read later'] }]);
  assert.strictEqual(C.inGroup(items, 'Recipes')[0].url, 'https://p.com/');
  assert.strictEqual(C.inGroup(items, 'Read later')[0].url, 'https://p.com/');
});

// --- SCN-004: Find a saved link by searching --------------------------------
test('SCN-004 search matches title, url, or group name (case-insensitive)', function () {
  const items = build([
    { url: 'example.com/pasta-night', groups: ['Recipes'] },
    { url: 'other.com/report', groups: ['Work'] }
  ]);
  assert.strictEqual(C.search(items, 'PASTA').length, 1, 'matches title/url');
  assert.strictEqual(C.search(items, 'recipes').length, 1, 'matches group name');
  assert.strictEqual(C.search(items, 'other.com').length, 1, 'matches url');
});

test('SCN-004 search spans all bookmarks regardless of a selected group', function () {
  const items = build([
    { url: 'example.com/pasta', groups: ['Recipes'] },
    { url: 'work.com/plan', groups: ['Work'] }
  ]);
  // Whatever group is "selected", search runs over the full set.
  assert.strictEqual(C.search(items, 'pasta').length, 1);
});

test('SCN-004 empty query returns everything', function () {
  const items = build([{ url: 'a.com' }, { url: 'b.com' }]);
  assert.strictEqual(C.search(items, '   ').length, 2);
});

// --- SCN-005: Edit a saved link's groups ------------------------------------
test('SCN-005 groups can be added and removed on an existing link', function () {
  const items = build([{ url: 'example.com', groups: ['Work'] }]);
  const bm = items[0];
  // remove
  bm.groups.splice(bm.groups.indexOf('Work'), 1);
  assert.deepStrictEqual(bm.groups, []);
  // add via canonicalization against existing groups
  const g = C.canonicalGroup('dinner', C.usedGroups(items).concat(bm.groups));
  bm.groups.push(g);
  assert.deepStrictEqual(bm.groups, ['dinner']);
});

// --- SCN-006: Remove a saved link -------------------------------------------
test('SCN-006 removing a link takes it out of the list', function () {
  const items = build([{ url: 'a.com' }, { url: 'b.com' }]);
  const target = items.find(function (i) { return i.url === 'https://a.com/'; });
  items.splice(items.indexOf(target), 1);
  assert.strictEqual(items.length, 1);
  assert.strictEqual(C.search(items, 'a.com').length, 0);
});

// --- SCN-007: A group disappears once its last link is gone -----------------
test('SCN-007 usedGroups reflects only groups still in use', function () {
  const items = build([
    { url: 'w.com', groups: ['Work'] },
    { url: 'r.com', groups: ['Recipes'] }
  ]);
  assert.deepStrictEqual(C.usedGroups(items).sort(), ['Recipes', 'Work']);
  // remove the only Work link
  items.splice(items.findIndex(function (i) { return i.url === 'https://w.com/'; }), 1);
  assert.deepStrictEqual(C.usedGroups(items), ['Recipes']);
  assert.ok(!C.usedGroups(items).includes('Work'), 'emptied group is gone');
});

// --- SCN-008: Empty and no-result states ------------------------------------
test('SCN-008 no matches yields an empty result set', function () {
  const items = build([{ url: 'a.com' }]);
  assert.strictEqual(C.search(items, 'zzzzz').length, 0);
});

// --- SCN-009: Reject input that isn't a web link ----------------------------
test('SCN-009 non-link text is refused', function () {
  const items = [];
  assert.strictEqual(C.validateAdd(items, 'just some random text').error, 'invalid');
  assert.strictEqual(C.looksLikeLink('just some random text'), false);
});

test('SCN-009 empty input is a no-op', function () {
  assert.strictEqual(C.validateAdd([], '   ').error, 'empty');
});

test('SCN-009 a bare domain is accepted (scheme optional)', function () {
  assert.strictEqual(C.looksLikeLink('example.com'), true);
  assert.strictEqual(C.validateAdd([], 'example.com/page').ok, true);
});

// --- SCN-010: Prevent duplicate links ---------------------------------------
test('SCN-010 saving an already-saved link is blocked and points to the original', function () {
  const items = build([{ url: 'theguardian.com/article' }]);
  const r = C.validateAdd(items, 'theguardian.com/article');
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.error, 'duplicate');
  assert.strictEqual(r.duplicate.url, 'https://theguardian.com/article');
});

test('SCN-010 duplicate detection ignores scheme, www, trailing slash and case', function () {
  const items = build([{ url: 'https://www.Example.com/Path/' }]);
  assert.ok(C.findDuplicate(items, 'example.com/Path'));
  assert.ok(C.findDuplicate(items, 'HTTP://Example.com/Path/'));
});

test('SCN-010 genuinely different links are not treated as duplicates', function () {
  const items = build([{ url: 'example.com/a' }]);
  assert.strictEqual(C.findDuplicate(items, 'example.com/b'), null);
});

// --- SCN-012: Group names are case-insensitive ------------------------------
test('SCN-012 typing "work" reuses an existing "Work" group', function () {
  const items = build([{ url: 'x.com', groups: ['Work'] }]);
  assert.strictEqual(C.canonicalGroup('work', C.usedGroups(items)), 'Work');
  assert.strictEqual(C.canonicalGroup('  WORK ', C.usedGroups(items)), 'Work');
});

test('SCN-012 a brand-new group keeps the typed spelling', function () {
  const items = build([{ url: 'x.com', groups: ['Work'] }]);
  assert.strictEqual(C.canonicalGroup('Travel', C.usedGroups(items)), 'Travel');
});

// --- SCN-011 is a presentational (layout) concern, verified in Phase 3.
