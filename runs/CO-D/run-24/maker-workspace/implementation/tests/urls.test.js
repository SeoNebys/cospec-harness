'use strict';
// Unit tests for URL helpers (SCN-001 dedupe equivalence, SCN-010 validity, SCN-014 PDF).
const test = require('node:test');
const assert = require('node:assert');
const { normalizeKey, looksLikeUrl, isPdfUrl } = require('../src/urls');

test('www and trailing slash are the same key (SCN-001)', () => {
  assert.equal(normalizeKey('example.com'), normalizeKey('https://www.example.com/'));
  assert.equal(normalizeKey('https://example.com'), normalizeKey('example.com/'));
});
test('different paths are different keys', () => {
  assert.notEqual(normalizeKey('example.com/a'), normalizeKey('example.com/b'));
});
test('bare domain is valid, junk text is not (SCN-010)', () => {
  assert.equal(looksLikeUrl('example.com'), true);
  assert.equal(looksLikeUrl('https://example.com'), true);
  assert.equal(looksLikeUrl('not a real address'), false);
  assert.equal(looksLikeUrl('hello'), false);
});
test('PDF detection (SCN-014)', () => {
  assert.equal(isPdfUrl('https://arxiv.org/x.pdf'), true);
  assert.equal(isPdfUrl('https://example.com/page'), false);
});
