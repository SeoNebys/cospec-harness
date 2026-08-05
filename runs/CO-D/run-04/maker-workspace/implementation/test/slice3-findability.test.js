// Slice 3 findability + the two edges the client poked at.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseTerms, matchesQuery, whereMatched, filterByTopics, tagCounts, sortLinks, noteText,
} from '../extension/src/query.js';
import { findDuplicateElsewhere, addTag, suggestTags, normalizeTag } from '../extension/src/core.js';

const lib = [
  { id: 1, title: 'Sourdough — Wikipedia', description: 'Bread by fermentation.', note: '', url: 'https://wikipedia.org/wiki/Sourdough', tags: ['recipes', 'baking'], savedAt: 30 },
  { id: 2, title: 'The Best Pizza Dough', description: 'A cold-ferment dough.', note: '', url: 'https://seriouseats.com/pizza-dough', tags: ['recipes', 'baking'], savedAt: 20 },
  { id: 3, title: 'Weeknight Ramen', description: 'A fast broth.', note: '', url: 'https://cooking.com/ramen', tags: ['recipes'], savedAt: 10 },
  { id: 4, title: '36 Hours in Kyoto', description: 'Temples at dawn.', note: '<p>Book a <b>ryokan</b> early.</p>', url: 'https://nytimes.com/travel/kyoto', tags: ['travel'], savedAt: 40 },
];

test('SCN-009: multiple words match in any order, across fields', () => {
  assert.ok(matchesQuery(lib[1], 'dough pizza'));           // both in title, reversed
  assert.ok(matchesQuery(lib[1], 'pizza dough'));
  assert.ok(matchesQuery(lib[3], 'kyoto temple'));          // title + description
  assert.ok(!matchesQuery(lib[2], 'pizza'));
});

test('SCN-009: quoted phrase matches exact wording only', () => {
  assert.ok(matchesQuery(lib[3], '"36 hours"'));
  assert.equal(parseTerms('"36 hours" kyoto').length, 2);   // phrase + word
});

test('SCN-009: search reaches the personal note, and flags where it hit', () => {
  assert.ok(matchesQuery(lib[3], 'ryokan'));                 // only in the note
  assert.deepEqual(whereMatched(lib[3], 'ryokan'), ['your note']);
  assert.deepEqual(whereMatched(lib[1], 'seriouseats'), ['the web address']);
  assert.equal(noteText('<p>Book a <b>ryokan</b> early.</p>'), 'Book a ryokan early.');
});

test('SCN-008: stacking topics narrows (AND)', () => {
  assert.deepEqual(filterByTopics(lib, ['recipes'], []).map((l) => l.id), [1, 2, 3]);
  assert.deepEqual(filterByTopics(lib, ['recipes', 'baking'], []).map((l) => l.id), [1, 2]);
});

test('SCN-021: excluding carves a topic out', () => {
  assert.deepEqual(filterByTopics(lib, ['recipes'], ['baking']).map((l) => l.id), [3]); // recipes but not baking
  assert.deepEqual(filterByTopics(lib, [], ['recipes']).map((l) => l.id), [4]);          // everything but recipes
});

test('SCN-014: sort orders, newest uses savedAt (real history)', () => {
  assert.deepEqual(sortLinks(lib, 'new').map((l) => l.id), [4, 1, 2, 3]);
  assert.deepEqual(sortLinks(lib, 'old').map((l) => l.id), [3, 2, 1, 4]);
  assert.equal(sortLinks(lib, 'az')[0].title, '36 Hours in Kyoto');
  assert.equal(sortLinks(lib, 'za')[0].title, 'Weeknight Ramen');
});

test('topic counts reflect the whole library', () => {
  assert.deepEqual(tagCounts(lib), { recipes: 3, baking: 2, travel: 1 });
});

test('SCN-003 back-door: editing an address into an existing one is caught', () => {
  // editing link 3 to point at link 2's address (differently written) -> clash
  assert.ok(findDuplicateElsewhere(lib, 3, 'HTTP://www.seriouseats.com/pizza-dough/'));
  assert.equal(findDuplicateElsewhere(lib, 3, 'https://brand-new.com/x'), null);
  assert.equal(findDuplicateElsewhere(lib, 2, 'https://seriouseats.com/pizza-dough'), null); // same link, fine
});

test('label anti-fork net is snug against capitals/trailing space', () => {
  const all = ['recipes', 'baking'];
  assert.deepEqual(suggestTags(all, 'Recipes ', []), ['recipes']); // steered to existing
  assert.deepEqual(addTag(['recipes'], 'Recipes '), ['recipes']);   // no twin created
  assert.equal(normalizeTag('  Recipes  '), 'recipes');
});
