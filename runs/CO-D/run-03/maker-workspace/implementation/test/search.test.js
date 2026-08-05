'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { searchRecords, parseQuery, describe } = require('../server/search');

const recs = [
  { id: '1', title: 'No-Knead Bread', summary: 'A loaf with a crackly crust.', labels: ['cooking'], url: 'https://k.example/bread', copyText: 'flour water salt yeast open crumb steam crust', savedAt: '2024-01-01' },
  { id: '2', title: 'Sourdough Guide', summary: 'Feeding and troubleshooting.', labels: ['cooking'], url: 'https://k.example/sour', copyText: 'a good sourdough bread has a springy crumb and crust', savedAt: '2023-01-01' },
  { id: '3', title: 'The Article', summary: 'Focus and attention.', labels: ['read'], url: 'https://b.example/a', copyText: 'attention is finite; willpower is barely needed', savedAt: '2025-01-01' },
  { id: '4', title: 'Why We Sleep', summary: 'Sleep and memory.', labels: ['health'], url: 'https://r.example/s', copyText: 'deep sleep consolidates memory; attention suffers', savedAt: '2022-01-01' },
];

// SCN-016: title hit outranks body-only hit.
test('title match ranks above body-only match', () => {
  const { results } = searchRecords(recs, 'bread');
  assert.equal(results[0].id, '1'); // "Bread" in title
  const sour = results.find((r) => r.id === '2');
  assert.ok(sour && !sour.strong); // "bread" only in body
  assert.ok(results.indexOf(results.find((r) => r.id === '1')) < results.indexOf(sour));
});

// SCN-016: loose multi-word AND across fields, not adjacency.
test('loose multi-word matches when scattered', () => {
  const { results } = searchRecords(recs, 'bread crust');
  const ids = results.map((r) => r.id);
  assert.ok(ids.includes('1'));
});

// SCN-015/016: find by a word only inside the saved copy, with a snippet.
test('body-only match returns a snippet and is weak', () => {
  const { results } = searchRecords(recs, 'willpower');
  const hit = results.find((r) => r.id === '3');
  assert.ok(hit);
  assert.equal(hit.strong, false);
  assert.ok(hit.snippet.toLowerCase().includes('willpower'));
});

// SCN-017: exact phrase.
test('quoted phrase requires the words together', () => {
  const a = searchRecords(recs, '"crackly crust"').results.map((r) => r.id);
  assert.ok(a.includes('1'));
  const b = searchRecords(recs, '"springy crackly"').results;
  assert.equal(b.length, 0);
});

// SCN-017: either-word.
test('or matches either alternative', () => {
  const ids = searchRecords(recs, 'bread or sleep').results.map((r) => r.id);
  assert.ok(ids.includes('1'));
  assert.ok(ids.includes('4'));
});

// SCN-017: exclude with natural words and minus.
test('not / without / minus exclude a term', () => {
  for (const q of ['crust not sourdough', 'crust without sourdough', 'crust -sourdough']) {
    const ids = searchRecords(recs, q).results.map((r) => r.id);
    assert.ok(ids.includes('1'), q);
    assert.ok(!ids.includes('2'), q + ' should drop sourdough');
  }
});

// SCN-017: interpretation description + literal escape via quotes.
test('describe reports phrase/either/without; and "or" chip is a word not an operator label', () => {
  assert.equal(describe(parseQuery('"coffee or tea"')).chips[0].kind, 'phrase');
  assert.equal(describe(parseQuery('coffee or tea')).chips[0].kind, 'either');
  assert.equal(describe(parseQuery('crust not sourdough')).chips.find((c) => c.kind === 'without').text, 'sourdough');
  // a quoted "or" is a literal word (phrase), not the either-operator
  const p = parseQuery('"or"');
  assert.equal(p.groups.length, 1);
  assert.equal(p.groups[0][0].phrase, true);
});
