'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { makePredicate } = require('../src/lib/query');

const DATA = [
  { title: 'The Quiet Art of Reading Later', url: 'https://nytimes.com/reading-later', site: 'nytimes.com', description: 'read later calmer', note: 'weekend post on focus', tags: ['reading', 'focus'] },
  { title: 'CSS Flexbox layout', url: 'https://developer.mozilla.org/flexbox', site: 'developer.mozilla.org', description: 'rows or columns', note: 'settings screen', tags: ['css', 'reference'] },
  { title: 'A weekend in Rome', url: 'https://travel.example.com/rome', site: 'travel.example.com', description: 'Forum to Trastevere', note: 'plan itinerary', tags: ['rome', 'article', 'travel'] },
  { title: 'SPQR: History of Rome', url: 'https://books.example.org/spqr', site: 'books.example.org', description: 'ancient Rome', note: 'buy paperback', tags: ['rome', 'book', 'history'] }
];
const run = (q) => DATA.filter(makePredicate(q)).map(b => b.title);

test('#tag matches a tag specifically', () => {
  assert.deepStrictEqual(run('#focus'), ['The Quiet Art of Reading Later']);
});

test('exact phrase requires words together', () => {
  assert.deepStrictEqual(run('"read later"'), ['The Quiet Art of Reading Later']);
  assert.deepStrictEqual(run('"later read"'), []);
});

test('boolean grouping rome (#article OR #book)', () => {
  assert.deepStrictEqual(run('rome (#article OR #book)').sort(),
    ['A weekend in Rome', 'SPQR: History of Rome'].sort());
});

test('negation rome NOT #book', () => {
  assert.deepStrictEqual(run('rome NOT #book'), ['A weekend in Rome']);
});

test('quoted operator is a literal word', () => {
  // "OR" as a literal: only rows containing the substring "or"
  const res = run('"OR"');
  assert.ok(res.includes('CSS Flexbox layout')); // "rows or columns"
  assert.ok(!res.includes('The Quiet Art of Reading Later'));
});

test('implicit AND between adjacent terms', () => {
  assert.deepStrictEqual(run('focus #reading'), ['The Quiet Art of Reading Later']);
});

test('case-insensitive', () => {
  assert.deepStrictEqual(run('ROME nOt #BOOK'), ['A weekend in Rome']);
});

test('search covers the full url', () => {
  assert.deepStrictEqual(run('spqr'), ['SPQR: History of Rome']);
  assert.deepStrictEqual(run('mozilla.org'), ['CSS Flexbox layout']);
});
