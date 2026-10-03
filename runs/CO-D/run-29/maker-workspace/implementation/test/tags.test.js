import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeTags, suggestTags } from '../lib/tags.js';

test('SCN-014: tags remain unique without regard to case and keep established spelling', () => {
  assert.deepEqual(normalizeTags(['TRAVEL', 'travel', 'Article'], ['travel']), ['travel', 'Article']);
});

test('SCN-004: previously used tags are suggested without selected tags', () => {
  assert.deepEqual(suggestTags(['travel', 'article', 'book'], 'tra', []), ['travel']);
  assert.deepEqual(suggestTags(['travel'], 'tra', ['travel']), []);
});
