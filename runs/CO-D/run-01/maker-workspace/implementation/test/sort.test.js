import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sortBookmarks } from '../src/core/sort.js';

const bms = [
  { id: 1, title: 'Banana', savedAt: '2026-06-20' },
  { id: 2, title: 'apple', savedAt: '2018-05-22' },
  { id: 3, title: 'Cherry', savedAt: '2026-07-01' },
];

// SCN-015: newest first (default)
test('newest first', () => {
  assert.deepEqual(sortBookmarks(bms, 'newest').map((b) => b.id), [3, 1, 2]);
});

// SCN-015: oldest first surfaces old imported links
test('oldest first surfaces the 2018 link', () => {
  assert.deepEqual(sortBookmarks(bms, 'oldest').map((b) => b.id), [2, 1, 3]);
});

// SCN-015: title A-Z, case-insensitive
test('title A-Z', () => {
  assert.deepEqual(sortBookmarks(bms, 'title').map((b) => b.title), ['apple', 'Banana', 'Cherry']);
});

test('does not mutate the input array', () => {
  const copy = bms.slice();
  sortBookmarks(bms, 'oldest');
  assert.deepEqual(bms, copy);
});
