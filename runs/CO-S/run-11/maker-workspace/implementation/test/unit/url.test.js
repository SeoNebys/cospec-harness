'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { isValidUrl, normalizeUrl } = require('../../src/url');

test('isValidUrl accepts http/https only (SCN-009)', () => {
  assert.ok(isValidUrl('https://example.com'));
  assert.ok(isValidUrl('http://example.com/path'));
  assert.ok(!isValidUrl('not a link'));
  assert.ok(!isValidUrl('ftp://example.com'));
  assert.ok(!isValidUrl(''));
  assert.ok(!isValidUrl(null));
});

test('normalizeUrl lowercases domain and ignores trailing slash (SCN-006)', () => {
  assert.strictEqual(
    normalizeUrl('https://github.com/pallets/flask'),
    normalizeUrl('https://GitHub.com/pallets/flask/')
  );
});

test('normalizeUrl keeps path capitalisation significant (SCN-006)', () => {
  assert.notStrictEqual(
    normalizeUrl('https://github.com/pallets/flask'),
    normalizeUrl('https://github.com/pallets/Flask')
  );
});

test('normalizeUrl keeps query string', () => {
  assert.notStrictEqual(
    normalizeUrl('https://example.com/a?x=1'),
    normalizeUrl('https://example.com/a?x=2')
  );
});

test('normalizeUrl returns null for invalid urls', () => {
  assert.strictEqual(normalizeUrl('nope'), null);
});
