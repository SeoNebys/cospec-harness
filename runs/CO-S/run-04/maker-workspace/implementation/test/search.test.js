'use strict';

// SCN-003: browse + live search (name and address), highlight, count, no-match.
const { test } = require('node:test');
const assert = require('node:assert');
const { matches, highlight, summarize } = require('../public/search');

const LIB = [
  { title: 'How to Pull the Perfect Shot of Espresso', url: 'https://coffeeweekly.com/perfect-espresso' },
  { title: 'The Best Hiking Trails Near Portland', url: 'https://trailfinder.example.com/portland' },
  { title: 'Design Systems at Scale', url: 'https://medium.com/design-systems' },
];

test('browse: no query shows the whole list with a saved-count label', () => {
  const s = summarize(LIB, '');
  assert.equal(s.shown.length, 3);
  assert.equal(s.label, '3 links saved');
  assert.equal(s.noMatch, false);
});

test('single-item count label is singular', () => {
  assert.equal(summarize(LIB.slice(0, 1), '').label, '1 link saved');
});

test('search filters live and reports "N of M"', () => {
  const s = summarize(LIB, 'espresso');
  assert.equal(s.shown.length, 1);
  assert.equal(s.shown[0].url, 'https://coffeeweekly.com/perfect-espresso');
  assert.equal(s.label, '1 of 3 links');
});

test('search matches the address even when the name does not (SCN-003)', () => {
  // "portland" appears in the address host; the query still surfaces it.
  const s = summarize(LIB, 'trailfinder');
  assert.equal(s.shown.length, 1);
  assert.equal(s.shown[0].title, 'The Best Hiking Trails Near Portland');
  assert.equal(matches(LIB[1], 'trailfinder'), true);
});

test('search is case-insensitive', () => {
  assert.equal(matches(LIB[0], 'ESPRESSO'), true);
});

test('no matches yields the no-match state', () => {
  const s = summarize(LIB, 'nonexistent');
  assert.equal(s.shown.length, 0);
  assert.equal(s.noMatch, true);
  assert.equal(s.label, 'No matches');
});

test('highlight wraps the matching part and escapes HTML', () => {
  assert.equal(highlight('Perfect Espresso', 'espresso'), 'Perfect <mark>Espresso</mark>');
  assert.equal(highlight('a<b>c', ''), 'a&lt;b&gt;c'); // escaping, no query
  assert.equal(highlight('safe', 'zzz'), 'safe'); // no match, no marks
});
