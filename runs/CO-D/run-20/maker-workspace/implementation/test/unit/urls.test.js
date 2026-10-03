import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeUrl, isValidUrl, dedupKey, isPdf, hostOf } from '../../src/urls.js';

test('normalizeUrl adds https when missing', () => {
  assert.equal(normalizeUrl('example.com'), 'https://example.com');
  assert.equal(normalizeUrl('http://x.com'), 'http://x.com');
});

test('isValidUrl rejects non-addresses (SCN-011)', () => {
  assert.equal(isValidUrl('not a url'), false);
  assert.equal(isValidUrl('hello'), false);
  assert.equal(isValidUrl('example.com/page'), true);
  assert.equal(isValidUrl('https://a.b.co/x'), true);
});

test('dedupKey ignores www, domain case and trailing slash (SCN-002)', () => {
  assert.equal(dedupKey('https://example.com/article'), dedupKey('https://WWW.Example.com/article/'));
});

test('dedupKey keeps path capitalisation distinct (SCN-002)', () => {
  assert.notEqual(dedupKey('https://example.com/Article'), dedupKey('https://example.com/article'));
});

test('isPdf detects .pdf with suffixes (SCN-016)', () => {
  assert.equal(isPdf('https://x.com/a.pdf'), true);
  assert.equal(isPdf('https://x.com/a.pdf?v=2'), true);
  assert.equal(isPdf('https://x.com/a.pdf#p1'), true);
  assert.equal(isPdf('https://x.com/pdf-guide'), false);
});

test('hostOf strips www', () => {
  assert.equal(hostOf('https://www.example.com/x'), 'example.com');
});
