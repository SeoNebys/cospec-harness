import test from 'node:test';
import assert from 'node:assert/strict';
import { matchesBookmark, uniqueLabels } from '../public/domain.js';

const bookmarks = [
  { title: 'JavaScript | MDN', description: 'Build interactive web experiences.', labels: ['learning', 'Reference'] },
  { title: 'Serious Eats', description: 'Tested recipes and deeply researched guides.', labels: ['cooking', 'reference'] }
];

test('SCN-006 search ignores case and matches partial title or description text', () => {
  assert.equal(matchesBookmark(bookmarks[0], 'INTERACT', 'all'), true);
  assert.equal(matchesBookmark(bookmarks[0], 'script', 'all'), true);
  assert.equal(matchesBookmark(bookmarks[1], 'INTERACT', 'all'), false);
});

test('SCN-005 and SCN-006 combine label and search filters', () => {
  assert.equal(matchesBookmark(bookmarks[0], 'guide', 'learning'), false);
  assert.equal(matchesBookmark(bookmarks[1], 'guide', 'cooking'), true);
  assert.equal(matchesBookmark(bookmarks[1], 'guide', 'learning'), false);
});

test('label navigation coalesces capitalization-only duplicates', () => {
  assert.deepEqual(uniqueLabels(bookmarks), ['cooking', 'learning', 'Reference']);
});
