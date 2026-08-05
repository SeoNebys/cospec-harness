import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  canonicalLabel, hasLabel, addLabel, removeLabel, folderPathToLabels, allLabels,
} from '../src/core/labels.js';

// SCN-006: reuse an existing label regardless of letter case (the reuse nudge).
test('canonicalLabel reuses an existing label case-insensitively', () => {
  assert.equal(canonicalLabel(['cooking'], 'Cooking'), 'cooking');
  assert.equal(canonicalLabel(['cooking'], 'COOKING'), 'cooking');
  assert.equal(canonicalLabel(['cooking'], 'italian'), 'italian'); // new, kept as typed
  assert.equal(canonicalLabel(['cooking'], '   '), null);
});

test('addLabel does not create a case-variant duplicate', () => {
  const b = { labels: ['cooking'] };
  const existing = ['cooking'];
  assert.equal(addLabel(b, existing, 'Cooking'), false); // reused, nothing added
  assert.deepEqual(b.labels, ['cooking']);
  assert.equal(addLabel(b, existing, 'italian'), true);
  assert.deepEqual(b.labels, ['cooking', 'italian']);
});

// SCN-006: a link can hold multiple labels; remove a label.
test('multiple labels and removal', () => {
  const b = { labels: [] };
  addLabel(b, [], 'cooking');
  addLabel(b, ['cooking'], 'italian');
  assert.deepEqual(b.labels, ['cooking', 'italian']);
  assert.equal(hasLabel(b, 'ITALIAN'), true);
  assert.equal(removeLabel(b, 'cooking'), true);
  assert.deepEqual(b.labels, ['italian']);
  assert.equal(removeLabel(b, 'nope'), false);
});

// SCN-013: folder path becomes SEPARATE lowercase labels, never combined.
test('folderPathToLabels splits nested folders', () => {
  assert.deepEqual(folderPathToLabels('Travel/Japan'), ['travel', 'japan']);
  assert.deepEqual(folderPathToLabels('Recipes/Italian'), ['recipes', 'italian']);
  assert.deepEqual(folderPathToLabels('History'), ['history']);
  assert.deepEqual(folderPathToLabels(''), []);
  assert.deepEqual(folderPathToLabels('  A / / B  '), ['a', 'b']); // messy segments ok
});

test('allLabels is the sorted distinct set', () => {
  const bms = [{ labels: ['history'] }, { labels: ['cooking', 'italian'] }, { labels: ['history'] }];
  assert.deepEqual(allLabels(bms), ['cooking', 'history', 'italian']);
});
