'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { normalizeUrl, canonicalUrl, sameLink } = require('../../src/urls');

test('normalizeUrl adds https:// when scheme is missing (SCN-009)', () => {
  assert.strictEqual(normalizeUrl('example.com'), 'https://example.com');
  assert.strictEqual(normalizeUrl('  example.com  '), 'https://example.com');
});

test('normalizeUrl keeps an existing scheme (SCN-009)', () => {
  assert.strictEqual(normalizeUrl('https://example.com'), 'https://example.com');
  assert.strictEqual(normalizeUrl('http://example.com'), 'http://example.com');
  assert.strictEqual(normalizeUrl('HTTP://EXAMPLE.com'), 'HTTP://EXAMPLE.com');
});

test('normalizeUrl returns empty for empty input', () => {
  assert.strictEqual(normalizeUrl(''), '');
  assert.strictEqual(normalizeUrl('   '), '');
  assert.strictEqual(normalizeUrl(null), '');
});

test('sameLink treats missing scheme / trailing slash / case as equal (SCN-008)', () => {
  assert.ok(sameLink('news.example.org', 'https://news.example.org'));
  assert.ok(sameLink('https://news.example.org/', 'news.example.org'));
  assert.ok(sameLink('HTTPS://News.Example.ORG', 'news.example.org'));
});

test('sameLink distinguishes genuinely different addresses (SCN-008)', () => {
  assert.ok(!sameLink('example.com/a', 'example.com/b'));
  assert.ok(!sameLink('example.com', 'example.org'));
});

test('canonicalUrl strips trailing slashes and lowercases', () => {
  assert.strictEqual(canonicalUrl('https://Example.com///'), 'https://example.com');
});
