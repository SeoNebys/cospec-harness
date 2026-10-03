import { test } from 'node:test';
import assert from 'node:assert/strict';
import { search } from '../../src/search.js';

const items = [
  { title: 'CSS grid layout · MDN', description: 'reference for grid', url: 'https://developer.mozilla.org/css/grid', notes: '', tags: ['css', 'reference', 'webdev'] },
  { title: 'A quiet guide to Kyoto', description: 'travel in japan', url: 'https://nytimes.com/kyoto', notes: 'check temple hours', tags: ['travel', 'japan'] },
  { title: 'Best roast chicken', description: 'weeknight method', url: 'https://seriouseats.com/chicken', notes: '', tags: ['recipe', 'cooking'] },
];

test('case-insensitive substring search (SCN-004)', () => {
  assert.equal(search(items, 'KYOTO').length, 1);
});

test('searches notes too (SCN-004)', () => {
  assert.equal(search(items, 'temple').length, 1);
});

test('exact phrase with quotes (SCN-004)', () => {
  assert.equal(search(items, '"roast chicken"').length, 1);
  assert.equal(search(items, '"chicken roast"').length, 0);
});

test('implicit AND between plain words (SCN-004)', () => {
  assert.equal(search(items, 'css grid').length, 1);
  assert.equal(search(items, 'css kyoto').length, 0);
});

test('OR / NOT / parentheses (SCN-004)', () => {
  assert.equal(search(items, 'kyoto OR chicken').length, 2);
  assert.equal(search(items, '(kyoto OR chicken) NOT nytimes').length, 1);
});

test('operators case-insensitive; quotes force literal (SCN-004)', () => {
  assert.equal(search(items, 'kyoto or chicken').length, search(items, 'kyoto OR chicken').length);
  // "or" as a literal word matches text containing "or"
  assert.ok(search(items, '"or"').length >= 1);
});

test('#tag matches exact tag (SCN-008)', () => {
  assert.equal(search(items, '#reference').length, 1);
  assert.equal(search(items, '#reference OR #recipe').length, 2);
  assert.equal(search(items, '#reference NOT #recipe').length, 1);
});
