import { test } from 'node:test';
import assert from 'node:assert/strict';
import { savedViewKey } from '../extension/src/query.js';

test('SCN-020: a saved view is identified by lens + topics(in/out) + search, not sort', () => {
  const a = savedViewKey('toread', ['work'], [], '');
  const b = savedViewKey('toread', ['work'], [], '');
  assert.equal(a, b);                                   // same combo -> same key
  assert.notEqual(a, savedViewKey('all', ['work'], [], ''));      // lens matters
  assert.notEqual(a, savedViewKey('toread', ['work'], ['dev'], '')); // exclusion matters
  assert.notEqual(a, savedViewKey('toread', ['work'], [], 'kyoto')); // search matters
});

test('SCN-020: topic order does not change identity; exclusions are remembered', () => {
  assert.equal(savedViewKey('all', ['recipes', 'baking'], [], ''), savedViewKey('all', ['baking', 'recipes'], [], ''));
  // "recipes but not baking" is a distinct, stable key
  assert.equal(savedViewKey('all', ['recipes'], ['baking'], ''), 'all|recipes|baking|');
});

test('SCN-014/020: sort is deliberately NOT part of a saved view key', () => {
  // key has no sort dimension, so a saved view never overrides the user's sort
  assert.equal(savedViewKey('all', [], [], 'cafe').split('|').length, 4);
});
