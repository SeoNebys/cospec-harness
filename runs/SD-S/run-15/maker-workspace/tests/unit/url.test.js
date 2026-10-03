import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeUrl, InvalidUrlError } from '../../src/services/url.js';

test('adds https scheme when missing', () => {
  assert.equal(normalizeUrl('example.com'), 'https://example.com/');
  assert.equal(normalizeUrl('example.com/path'), 'https://example.com/path');
});

test('preserves existing http/https scheme', () => {
  assert.equal(normalizeUrl('http://example.com/'), 'http://example.com/');
  assert.equal(normalizeUrl('https://a.example.com/x?y=1'), 'https://a.example.com/x?y=1');
});

test('trims surrounding whitespace', () => {
  assert.equal(normalizeUrl('  example.com  '), 'https://example.com/');
});

test('rejects empty input', () => {
  assert.throws(() => normalizeUrl(''), InvalidUrlError);
  assert.throws(() => normalizeUrl('   '), InvalidUrlError);
  assert.throws(() => normalizeUrl(null), InvalidUrlError);
});

test('rejects non-http(s) schemes', () => {
  assert.throws(() => normalizeUrl('ftp://example.com'), InvalidUrlError);
  assert.throws(() => normalizeUrl('javascript:alert(1)'), InvalidUrlError);
});

test('rejects hostnames without a dot', () => {
  assert.throws(() => normalizeUrl('notaurl'), InvalidUrlError);
});
