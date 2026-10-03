import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeUrl, labelFromUrl } from '../server/url.js';

test('prepends https:// when no scheme is present (FR-003)', () => {
  assert.equal(normalizeUrl('example.com'), 'https://example.com/');
  assert.equal(normalizeUrl('example.com/page'), 'https://example.com/page');
  assert.equal(normalizeUrl('  example.com  '), 'https://example.com/');
});

test('keeps an existing valid scheme', () => {
  assert.equal(normalizeUrl('http://example.com'), 'http://example.com/');
  assert.equal(normalizeUrl('https://example.com/a?b=1'), 'https://example.com/a?b=1');
});

test('rejects unparseable input (FR-002)', () => {
  assert.throws(() => normalizeUrl('not a url'), (e) => e.code === 'INVALID_URL');
  assert.throws(() => normalizeUrl(''), (e) => e.code === 'INVALID_URL');
  assert.throws(() => normalizeUrl('   '), (e) => e.code === 'INVALID_URL');
});

test('rejects non-http(s) schemes (FR-002)', () => {
  assert.throws(() => normalizeUrl('ftp://example.com'), (e) => e.code === 'INVALID_URL');
  assert.throws(() => normalizeUrl('javascript:alert(1)'), (e) => e.code === 'INVALID_URL');
});

test('labelFromUrl derives host + path (FR-004)', () => {
  assert.equal(labelFromUrl('https://example.com/'), 'example.com');
  assert.equal(labelFromUrl('https://example.com/page'), 'example.com/page');
});
