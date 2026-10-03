'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { normalizeUrl, canonicalKey } = require('../../public/lib/canonical.js');

test('normalizeUrl adds scheme and rejects junk (SCN-001, SCN-013)', () => {
  assert.strictEqual(normalizeUrl('example.com'), 'https://example.com/');
  assert.strictEqual(normalizeUrl('  http://a.test/x '), 'http://a.test/x');
  assert.strictEqual(normalizeUrl(''), '');
  assert.strictEqual(normalizeUrl('not a url @@'), '');
});

test('canonicalKey treats scheme/www/trailing-slash/fragment as the same (SCN-002)', () => {
  const a = canonicalKey('https://www.wikipedia.org/');
  assert.strictEqual(a, canonicalKey('http://wikipedia.org'));
  assert.strictEqual(a, canonicalKey('https://wikipedia.org/#section'));
  // a bare host is understood once normalized (the flow used by the store)
  assert.strictEqual(a, canonicalKey(normalizeUrl('wikipedia.org')));
});

test('canonicalKey distinguishes different paths/queries', () => {
  assert.notStrictEqual(canonicalKey('https://a.test/one'), canonicalKey('https://a.test/two'));
  assert.notStrictEqual(canonicalKey('https://a.test/p?x=1'), canonicalKey('https://a.test/p?x=2'));
});
