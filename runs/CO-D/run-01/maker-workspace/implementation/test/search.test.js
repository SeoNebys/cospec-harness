import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matches, search, stem } from '../src/core/search.js';

const bms = [
  { title: 'Ancient Rome - Wikipedia', summary: 'A civilization that became an empire ruling the Mediterranean.', note: '', url: 'https://en.wikipedia.org/wiki/Ancient_Rome', labels: ['history'] },
  { title: 'Classic Spaghetti Carbonara', summary: 'A traditional Roman pasta dish with guanciale.', note: 'Mum loved this one.', url: 'https://cooking.example.com/carbonara', labels: ['cooking', 'italian'] },
  { title: 'Romania Travel Guide', summary: 'Castles and the Black Sea coast.', note: '', url: 'https://travel.example.com/romania', labels: ['travel'] },
  { title: 'Understanding JavaScript Promises', summary: 'Async programming with promises.', note: '', url: 'https://dev.example.com/js', labels: ['coding'] },
];

// SCN-005: match inside the summary, not only the title.
test('search finds a link by a word in its summary', () => {
  const r = search(bms, 'empire').map((b) => b.title);
  assert.deepEqual(r, ['Ancient Rome - Wikipedia']);
});

// SCN-005: word variations — "Rome" finds "Roman" but not "Romania".
test('word-variation matching: Rome finds Roman, not Romania', () => {
  const titles = search(bms, 'Rome').map((b) => b.title);
  assert.ok(titles.includes('Ancient Rome - Wikipedia'));
  assert.ok(titles.includes('Classic Spaghetti Carbonara'), 'Roman should match Rome');
  assert.ok(!titles.includes('Romania Travel Guide'), 'Romania must NOT match Rome');
});

test('stem unifies word forms but keeps unrelated words apart', () => {
  assert.equal(stem('rome'), stem('roman'));
  assert.notEqual(stem('rome'), stem('romania'));
  assert.equal(stem('cooking'), stem('cook'));
  assert.equal(stem('recipes'), stem('recipe'));
});

// SCN-011: personal notes are searchable.
test('search matches inside the personal note', () => {
  const r = search(bms, 'mum').map((b) => b.title);
  assert.deepEqual(r, ['Classic Spaghetti Carbonara']);
});

// SCN-005: every typed word must be found (across any field).
test('multi-word query requires all words', () => {
  assert.equal(matches(bms[1], 'pasta guanciale'), true);
  assert.equal(matches(bms[1], 'pasta zebra'), false);
});

test('labels are searchable', () => {
  const r = search(bms, 'italian').map((b) => b.title);
  assert.deepEqual(r, ['Classic Spaghetti Carbonara']);
});

test('empty query returns everything', () => {
  assert.equal(search(bms, '').length, bms.length);
});
