import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateAddress, normalizeKey } from '../../src/bookmarks.js';

test('validateAddress accepts well-formed http/https URLs', () => {
  assert.ok(validateAddress('https://example.com'));
  assert.ok(validateAddress('http://example.com/path'));
});

test('validateAddress rejects empty and malformed input', () => {
  assert.equal(validateAddress(''), null);
  assert.equal(validateAddress('   '), null);
  assert.equal(validateAddress('not a url'), null);
  assert.equal(validateAddress('ftp://example.com'), null);
  assert.equal(validateAddress(null), null);
});

test('normalizeKey treats case and trailing slash as equal (FR-015)', () => {
  const a = normalizeKey('https://Example.com/');
  const b = normalizeKey('https://example.com');
  assert.equal(a, b);
});

test('normalizeKey keeps distinct paths distinct', () => {
  assert.notEqual(
    normalizeKey('https://example.com/a'),
    normalizeKey('https://example.com/b')
  );
});
