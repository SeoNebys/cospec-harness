import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeTag, addTag, removeTag } from '../../src/tags.js';

test('normalizeTag lowercases and hyphenates spaces (SCN-008)', () => {
  assert.equal(normalizeTag('Machine Learning'), 'machine-learning');
  assert.equal(normalizeTag('#Travel'), 'travel');
  assert.equal(normalizeTag('  Web Dev '), 'web-dev');
});

test('addTag de-duplicates on one bookmark (SCN-008)', () => {
  let tags = [];
  tags = addTag(tags, 'news');
  tags = addTag(tags, 'News'); // normalises to same
  assert.deepEqual(tags, ['news']);
});

test('removeTag removes only the matching normalised tag', () => {
  assert.deepEqual(removeTag(['a', 'b'], 'A'), ['b']);
});
