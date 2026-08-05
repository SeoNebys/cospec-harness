'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { looksLikeUrl, normUrl } = require('../server/url');

// SCN-013: reject obvious non-links.
test('looksLikeUrl accepts real addresses and adds scheme', () => {
  assert.equal(looksLikeUrl('https://example.com/a'), 'https://example.com/a');
  assert.equal(looksLikeUrl('example.com/a'), 'https://example.com/a');
});
test('looksLikeUrl rejects non-links', () => {
  assert.equal(looksLikeUrl('not a real link'), null);
  assert.equal(looksLikeUrl('justtext'), null);
  assert.equal(looksLikeUrl(''), null);
});

// SCN-004: duplicate detection tolerant of trivial differences.
test('normUrl ignores scheme, www, trailing slash, case', () => {
  const a = normUrl('https://www.Example.com/page/');
  const b = normUrl('http://example.com/page');
  assert.equal(a, b);
});
