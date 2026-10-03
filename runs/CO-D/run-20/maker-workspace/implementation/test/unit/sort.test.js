import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sortItems } from '../../src/sort.js';

const items = [
  { title: 'Beta', createdAt: 100, updatedAt: 100 },
  { title: 'alpha', createdAt: 200, updatedAt: 500 },
  { title: 'Gamma', createdAt: 300, updatedAt: 150 },
];

test('added-desc newest first (SCN-013)', () => {
  assert.deepEqual(sortItems(items, 'added-desc').map((x) => x.createdAt), [300, 200, 100]);
});
test('added-asc oldest first', () => {
  assert.deepEqual(sortItems(items, 'added-asc').map((x) => x.createdAt), [100, 200, 300]);
});
test('updated-desc by last change (SCN-013)', () => {
  assert.deepEqual(sortItems(items, 'updated-desc').map((x) => x.updatedAt), [500, 150, 100]);
});
test('title A-Z is case-insensitive', () => {
  assert.deepEqual(sortItems(items, 'title-asc').map((x) => x.title), ['alpha', 'Beta', 'Gamma']);
});
test('title Z-A', () => {
  assert.deepEqual(sortItems(items, 'title-desc').map((x) => x.title), ['Gamma', 'Beta', 'alpha']);
});
