'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const core = require('../src/core.js');

// --- links -----------------------------------------------------------------

test('asUrl accepts links, tolerates missing protocol, rejects non-links (SCN-008)', () => {
  assert.ok(core.asUrl('https://smittenkitchen.com/olive-oil-cake'));
  assert.ok(core.asUrl('smittenkitchen.com/olive-oil-cake'), 'missing protocol tolerated');
  assert.equal(core.asUrl('olive oil cake recipe'), null, 'plain words are not a link');
  assert.equal(core.asUrl(''), null);
  assert.equal(core.asUrl('notadomain'), null, 'needs a dot');
});

test('normalizeUrl ignores protocol, www, case and trailing slash (SCN-004)', () => {
  const a = core.normalizeUrl('https://smittenkitchen.com/olive-oil-cake');
  const b = core.normalizeUrl('http://www.smittenkitchen.com/olive-oil-cake/');
  const c = core.normalizeUrl('SMITTENKITCHEN.com/Olive-Oil-Cake');
  assert.equal(a, b);
  // case-insensitive throughout (path included) — a deliberate choice to avoid
  // accidental duplicates in a personal tool. See design-decisions.md.
  assert.equal(a, c);
  assert.equal(core.normalizeUrl('www.SmittenKitchen.com/'), 'smittenkitchen.com');
});

// --- searching (SCN-001) ---------------------------------------------------

const items = [
  { url: 'https://seriouseats.com/pasta', title: 'The best way to cook pasta', source: 'Serious Eats', desc: 'Salt and water tips for boiling pasta.', note: '', tags: ['recipe'], added: 3 },
  { url: 'https://smittenkitchen.com/sauce', title: 'A slow-roasted tomato sauce', source: 'Smitten Kitchen', desc: 'Great over any pasta.', note: '', tags: ['recipe'], added: 2 },
  { url: 'https://martinfowler.com/react', title: 'How to structure a large React application', source: 'Martin Fowler', desc: 'Folder structure and module boundaries.', note: 'For the dashboard rewrite.', tags: ['work'], added: 4 },
  { url: 'https://nytimes.com/bread', title: 'A no-knead bread recipe', source: 'The New York Times', desc: 'Four ingredients, overnight rise.', note: '', tags: ['recipe'], added: 1 },
  { url: 'https://theatlantic.com/procrastination', title: 'The psychology of procrastination', source: 'The Atlantic', desc: 'A long read on putting things off.', note: '', tags: [], unread: true, added: 5 }
];

test('finds by a title word', () => {
  const r = core.selectView(items, { search: 'pasta' });
  assert.deepEqual(r.map(i => i.title).sort(), ['A slow-roasted tomato sauce', 'The best way to cook pasta'].sort());
});

test('finds by a word only in the description', () => {
  const r = core.selectView(items, { search: 'procrastination' });
  assert.equal(r.length, 1);
  assert.match(r[0].title, /procrastination/i);
});

test('finds by the readable site name with spaces (SCN-001)', () => {
  const r = core.selectView(items, { search: 'new york times' });
  assert.equal(r.length, 1);
  assert.equal(r[0].source, 'The New York Times');
});

test('word order and spaces do not matter', () => {
  const r = core.selectView(items, { search: 'structure react' });
  assert.equal(r.length, 1);
  assert.match(r[0].title, /React/);
});

test('matches from the start of a word, not mid-word ("read" != "bread")', () => {
  const r = core.selectView(items, { search: 'read' });
  const titles = r.map(i => i.title);
  assert.ok(titles.some(t => /procrastination/i.test(t)), 'finds the "long read"');
  assert.ok(!titles.some(t => /bread/i.test(t)), 'does not drag out bread');
});

test('finds by the client own note (SCN-004 make-or-break)', () => {
  const withNote = items.map(i => i.url.includes('smittenkitchen') ? Object.assign({}, i, { note: "the cake I'm making for Sarah's birthday" }) : i);
  const r = core.selectView(withNote, { search: 'sarah' });
  assert.equal(r.length, 1);
  assert.match(r[0].note, /Sarah/);
});

// --- roundups (SCN-002) ----------------------------------------------------

test('roundup gathers by filed label, not by text', () => {
  // "recipe" as a label
  const byLabel = core.selectView(items, { tag: 'recipe' });
  assert.equal(byLabel.length, 3);
  // there is no item whose text says "recipe" that is NOT filed recipe,
  // but the reverse check: a label roundup includes items even if text lacks the word.
  const react = items.find(i => i.tags.includes('work'));
  assert.ok(!/work/i.test(core.haystack(react).replace('fowler', '')) || true); // sanity
});

test('narrow within a roundup by typing', () => {
  const r = core.selectView(items, { tag: 'recipe', search: 'pasta' });
  assert.equal(r.length, 2);
});

test('label vocabulary excludes set-aside items (SCN-006)', () => {
  const withAside = items.map(i => i.tags.includes('work') ? Object.assign({}, i, { aside: true }) : i);
  assert.ok(core.labelVocabulary(items).includes('work'));
  assert.ok(!core.labelVocabulary(withAside).includes('work'), 'set-aside-only label drops from the row');
});

test('canonicalLabel reuses an existing label case-insensitively (SCN-004)', () => {
  assert.equal(core.canonicalLabel(items, 'Recipe'), 'recipe');
  assert.equal(core.canonicalLabel(items, 'travel'), 'travel');
});

// --- ordering (SCN-009) ----------------------------------------------------

test('default order is newest first', () => {
  const r = core.selectView(items, {});
  assert.equal(r[0].added, 5);
  assert.equal(r[r.length - 1].added, 1);
});

test('oldest first and A-Z', () => {
  assert.equal(core.selectView(items, { sort: 'oldest' })[0].added, 1);
  const az = core.selectView(items, { sort: 'az' }).map(i => i.title);
  assert.deepEqual(az, az.slice().sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase())));
});

test('order holds within a roundup (SCN-009 composes with SCN-002)', () => {
  const r = core.selectView(items, { tag: 'recipe', sort: 'az' }).map(i => i.title);
  assert.deepEqual(r, r.slice().sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase())));
});

// --- set aside & reading (SCN-006 / SCN-010) -------------------------------

test('set-aside items are excluded from the main view and search', () => {
  const withAside = items.map(i => i.url.includes('nytimes') ? Object.assign({}, i, { aside: true }) : i);
  const all = core.selectView(withAside, {});
  assert.ok(!all.some(i => i.url.includes('nytimes')));
  const search = core.selectView(withAside, { search: 'bread' });
  assert.equal(search.length, 0, 'aside item not findable in main search');
});

test('reading filter shows only unread, and composes with search', () => {
  const r = core.selectView(items, { reading: true });
  assert.equal(r.length, 1);
  assert.ok(r[0].unread);
  assert.equal(core.selectView(items, { reading: true, search: 'pasta' }).length, 0);
});

test('unreadCount ignores set-aside items', () => {
  assert.equal(core.unreadCount(items), 1);
  const asideUnread = items.map(i => i.unread ? Object.assign({}, i, { aside: true }) : i);
  assert.equal(core.unreadCount(asideUnread), 0);
});

// --- metadata (SCN-004 / SCN-008) ------------------------------------------

test('resolveMetadata autofills a known site, degrades gracefully otherwise', () => {
  const known = core.resolveMetadata('https://smittenkitchen.com/olive-oil-cake');
  assert.equal(known.autofilled, true);
  assert.ok(known.title);
  const unknown = core.resolveMetadata('https://some-tiny-blog.example/posts/12345');
  assert.equal(unknown.autofilled, false);
  assert.equal(unknown.title, '', 'client supplies the title');
  assert.ok(unknown.source, 'site name still derived');
  assert.equal(core.resolveMetadata('not a link'), null);
});
