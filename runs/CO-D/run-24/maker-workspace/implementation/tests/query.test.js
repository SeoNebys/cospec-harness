'use strict';
// Unit tests for the search query language (SCN-004).
const test = require('node:test');
const assert = require('node:assert');
const Query = require('../public/query.js');

function mk(o) { return Object.assign({ title: '', description: '', note: '', url: '', tags: [] }, o); }
const items = {
  A: mk({ title: 'Rome travel guide', tags: ['article', 'travel'] }),
  B: mk({ title: 'History of Rome', tags: ['book'] }),
  C: mk({ title: 'Paris food', tags: ['article'] }),
  D: mk({ note: 'this or that', tags: ['misc'] }),
  E: mk({ title: 'quarterly report draft', tags: ['work'] }),
  F: mk({ title: 'reading list', tags: ['reading'] }),
};
function hits(q) { return Object.keys(items).filter((k) => Query.matches(q, items[k])); }

test('case-insensitive plain search', () => {
  assert.deepEqual(hits('ROME'), hits('rome'));
  assert.deepEqual(hits('rome').sort(), ['A', 'B']);
});
test('#tag matches only the tag, not the word', () => {
  assert.deepEqual(hits('#reading'), ['F']);
});
test('exact phrase in quotes', () => {
  assert.deepEqual(hits('"quarterly report"'), ['E']);
});
test('two words imply AND', () => {
  assert.deepEqual(hits('quarterly report'), ['E']);
});
test('OR and grouping with tags', () => {
  assert.deepEqual(hits('rome (#article OR #book)').sort(), ['A', 'B']);
});
test('NOT excludes', () => {
  assert.deepEqual(hits('rome NOT #book'), ['A']);
});
test('quoted operator is literal text', () => {
  assert.ok(hits('"or"').includes('D'));
});
test('empty query matches all', () => {
  assert.equal(hits('').length, Object.keys(items).length);
});
