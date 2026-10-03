'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { normalizeKey, canonicalHref, looksLikePdf } = require('../src/lib/normalize');

// SCN-006: sameness rules
test('scheme, www, trailing slash, case, fragment, tracking params are ignored', () => {
  const a = normalizeKey('https://www.NYTimes.com/2026/01/12/reading-later.html');
  const b = normalizeKey('nytimes.com/2026/01/12/reading-later.html/?utm_source=twitter&utm_campaign=x#top');
  assert.strictEqual(a, b);
});

test('non-tracking query params remain significant', () => {
  const a = normalizeKey('https://example.com/item?id=1');
  const b = normalizeKey('https://example.com/item?id=2');
  assert.notStrictEqual(a, b);
});

test('http vs https are the same', () => {
  assert.strictEqual(normalizeKey('http://example.com/x'), normalizeKey('https://example.com/x'));
});

test('query param order does not matter', () => {
  assert.strictEqual(normalizeKey('https://e.com/p?b=2&a=1'), normalizeKey('https://e.com/p?a=1&b=2'));
});

test('invalid input returns null', () => {
  assert.strictEqual(normalizeKey(''), null);
  assert.strictEqual(normalizeKey('   '), null);
});

test('canonicalHref keeps scheme and drops tracking + fragment', () => {
  assert.strictEqual(
    canonicalHref('https://www.example.com/a?utm_source=x&id=9#frag'),
    'https://www.example.com/a?id=9'
  );
});

test('looksLikePdf detects .pdf', () => {
  assert.ok(looksLikePdf('https://x.com/report.pdf'));
  assert.ok(!looksLikePdf('https://x.com/page.html'));
});
