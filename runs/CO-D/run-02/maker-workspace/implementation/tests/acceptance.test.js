'use strict';
/*
 * Acceptance tests — one describe block per approved scenario, exercised through
 * the real store (with in-memory storage). These mirror the Gherkin in
 * context/scenarios/SCN-*.md.
 */
const { test } = require('node:test');
const assert = require('node:assert');
const { createStore } = require('../src/store.js');

function freshStore(seed) {
  return createStore({ storage: require('../src/store.js').memoryStorage(), seed: seed });
}

// ---- SCN-004: saving, duplicates, own note --------------------------------

test('SCN-004 save with almost no effort, note is searchable, no duplicates', () => {
  const s = freshStore();
  const r = s.add({ url: 'https://smittenkitchen.com/olive-oil-cake', title: 'Olive oil cake', source: 'Smitten Kitchen', desc: 'A one-bowl cake.', note: "the cake I'm making for Sarah's birthday", tags: ['recipe'], unread: false });
  assert.ok(r.added);

  // found by the client's own words, not the page's
  const bySarah = s.view({ search: 'sarah' });
  assert.equal(bySarah.length, 1);

  // re-saving the same link (superficially different) makes no second copy
  const again = s.add({ url: 'http://www.smittenkitchen.com/olive-oil-cake/' });
  assert.ok(again.duplicate);
  assert.equal(s.all().length, 1);
  assert.equal(again.item.title, 'Olive oil cake');
});

test('SCN-004 reuse an existing label instead of creating a near-duplicate', () => {
  const s = freshStore();
  s.add({ url: 'https://a.com/x', tags: ['recipe'] });
  assert.equal(s.canonicalLabel('Recipe'), 'recipe');
});

// ---- SCN-005: editing -----------------------------------------------------

test('SCN-005 edit fields and fix a moved link; block a colliding link', () => {
  const s = freshStore();
  s.add({ url: 'https://a.com/one', title: 'One' });
  s.add({ url: 'https://b.com/two', title: 'Two' });

  const ok = s.update('https://a.com/one', { title: 'One (edited)', note: 'my note', url: 'https://a.com/one-moved' });
  assert.ok(ok.ok);
  assert.equal(s.find('https://a.com/one-moved').title, 'One (edited)');

  // moving onto an address another bookmark owns is blocked
  const clash = s.update('https://a.com/one-moved', { url: 'https://b.com/two' });
  assert.ok(!clash.ok);
  assert.ok(clash.clash);
});

// ---- SCN-006: set aside / delete / undo -----------------------------------

test('SCN-006 set aside hides from list/search; bring back restores', () => {
  const s = freshStore();
  s.add({ url: 'https://a.com/bread', title: 'No-knead bread', tags: ['recipe'] });
  s.setAside('https://a.com/bread', true);
  assert.equal(s.view({}).length, 0);
  assert.equal(s.view({ search: 'bread' }).length, 0);
  assert.equal(s.asideItems().length, 1);
  s.setAside('https://a.com/bread', false);
  assert.equal(s.view({}).length, 1);
});

test('SCN-006 delete removes; undo data allows exact restore', () => {
  const s = freshStore();
  s.add({ url: 'https://a.com/1', title: 'First' });
  s.add({ url: 'https://a.com/2', title: 'Second' });
  const removed = s.remove('https://a.com/2');
  assert.equal(s.all().length, 1);
  s.insertAt(removed.item, removed.index); // undo
  assert.equal(s.all().length, 2);
  assert.ok(s.find('https://a.com/2'));
});

// ---- SCN-009: ordering preference persistence -----------------------------

test('SCN-009 sort preference persists across store re-creation (a return visit)', () => {
  const storage = require('../src/store.js').memoryStorage();
  const s1 = createStore({ storage: storage });
  s1.setSort('az');
  const s2 = createStore({ storage: storage }); // "reopen"
  assert.equal(s2.getSort(), 'az');
  const bad = createStore({ storage: require('../src/store.js').memoryStorage() });
  assert.equal(bad.getSort(), 'newest', 'defaults to newest');
});

test('SCN-009 items and their order survive a reopen (persistence)', () => {
  const storage = require('../src/store.js').memoryStorage();
  const s1 = createStore({ storage: storage });
  s1.add({ url: 'https://a.com/old', title: 'Old' });
  s1.add({ url: 'https://a.com/new', title: 'New' });
  const s2 = createStore({ storage: storage });
  assert.equal(s2.all().length, 2);
  assert.equal(s2.view({})[0].title, 'New', 'newest first preserved');
});

// ---- SCN-010: reading pile ------------------------------------------------

test('SCN-010 flag on save, view the pile, mark read clears it', () => {
  const s = freshStore();
  s.add({ url: 'https://a.com/read', title: 'An essay', unread: true });
  s.add({ url: 'https://a.com/recipe', title: 'A recipe', unread: false });
  assert.equal(s.unreadCount(), 1);
  assert.deepEqual(s.view({ reading: true }).map(i => i.title), ['An essay']);

  s.setUnread('https://a.com/read', false); // mark read
  assert.equal(s.unreadCount(), 0);
  assert.equal(s.view({ reading: true }).length, 0, 'pile empties itself');
});

test('SCN-010 reading is a state independent of labels; flag an old one', () => {
  const s = freshStore();
  s.add({ url: 'https://a.com/x', title: 'X', unread: false, tags: [] });
  s.setUnread('https://a.com/x', true); // "to read" on an already-saved item
  assert.equal(s.unreadCount(), 1);
});

// ---- SCN-007: empty views are distinguishable -----------------------------

test('SCN-007 day-one vs everything-set-aside are different situations', () => {
  const s = freshStore();
  assert.equal(s.all().length, 0, 'day one: nothing saved');
  s.add({ url: 'https://a.com/x', title: 'X' });
  s.setAside('https://a.com/x', true);
  assert.equal(s.all().length, 1, 'things exist...');
  assert.equal(s.view({}).length, 0, '...but the main list is empty because all are set aside');
  assert.equal(s.asideItems().length, 1);
});
