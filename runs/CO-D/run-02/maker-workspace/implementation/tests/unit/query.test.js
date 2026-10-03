'use strict';
// Unit tests for the search query language (SCN-005).
const { test } = require('node:test');
const assert = require('node:assert');
const Q = require('../../public/query.js');

const b = (o) => Object.assign({ title: '', description: '', note: '', tags: [], host: '', url: '' }, o);
const items = [
  b({ title: 'Rome history', description: 'ancient city', note: 'read later', tags: ['article', 'history'], host: 'nytimes.com', url: 'https://nytimes.com/rome-guide' }),
  b({ title: 'Rome guidebook', description: 'trip planning', tags: ['book', 'travel'], host: 'shop.com', url: 'https://shop.com/rome' }),
  b({ title: 'Async Rust', description: 'concurrency', tags: ['book', 'coding'], host: 'dev.to', url: 'https://dev.to/async-rust' }),
  b({ title: 'Carbonara', description: 'dinner AND easy', tags: ['recipes'], host: 'recipes.com', url: 'https://recipes.com/carbonara' })
];
const run = (q) => items.filter(Q.makeFilter(q).test).map(x => x.title).sort();

test('plain word matches across fields', () => {
  assert.deepEqual(run('rome'), ['Rome guidebook', 'Rome history']);
});
test('word found only in the URL', () => {
  assert.deepEqual(run('async-rust'), ['Async Rust']);
});
test('word found only in the description', () => {
  assert.deepEqual(run('concurrency'), ['Async Rust']);
});
test('word found only in the note', () => {
  assert.deepEqual(run('later'), ['Rome history']);
});
test('two words require both (implicit AND)', () => {
  assert.deepEqual(run('rome book'), ['Rome guidebook']);
});
test('exact #tag', () => {
  assert.deepEqual(run('#book'), ['Async Rust', 'Rome guidebook']);
});
test('#tag is exact, not substring', () => {
  assert.deepEqual(run('#boo'), []);
});
test('quoted phrase', () => {
  assert.deepEqual(run('"trip planning"'), ['Rome guidebook']);
});
test('quoted operator is literal text', () => {
  assert.deepEqual(run('"AND"'), ['Carbonara']);
});
test('boolean with grouping', () => {
  assert.deepEqual(run('rome (#article OR #book)'), ['Rome guidebook', 'Rome history']);
});
test('NOT excludes', () => {
  assert.deepEqual(run('#book NOT rust'), ['Rome guidebook']);
});
test('case-insensitive', () => {
  assert.deepEqual(run('ROME'), ['Rome guidebook', 'Rome history']);
});
test('empty query matches all', () => {
  assert.equal(items.filter(Q.makeFilter('').test).length, 4);
});
test('malformed query reports error and falls back to words', () => {
  const f = Q.makeFilter('rome (');
  assert.equal(f.error, true);
  assert.deepEqual(items.filter(f.test).map(x => x.title).sort(), ['Rome guidebook', 'Rome history']);
});
