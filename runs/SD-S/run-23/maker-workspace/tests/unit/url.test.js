import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeUrl, ValidationError } from '../../src/bookmarks.js';

test('adds https:// when scheme omitted', () => {
  assert.equal(normalizeUrl('example.com'), 'https://example.com/');
  assert.equal(normalizeUrl('example.com/a/b'), 'https://example.com/a/b');
});

test('preserves existing scheme', () => {
  assert.equal(normalizeUrl('http://example.com'), 'http://example.com/');
});

test('trims surrounding whitespace', () => {
  assert.equal(normalizeUrl('  example.com  '), 'https://example.com/');
});

test('rejects empty address', () => {
  assert.throws(() => normalizeUrl(''), ValidationError);
  assert.throws(() => normalizeUrl('   '), ValidationError);
});

test('rejects non-http(s) schemes', () => {
  assert.throws(() => normalizeUrl('ftp://example.com'), ValidationError);
  assert.throws(() => normalizeUrl('javascript:alert(1)'), ValidationError);
});

test('rejects malformed hostnames', () => {
  assert.throws(() => normalizeUrl('notaurl'), ValidationError);
});
