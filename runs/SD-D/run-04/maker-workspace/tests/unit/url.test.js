import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isValidUrl, normalizeKey, isPdfUrl } from '../../src/services/url.js';

test('rejects non-http(s) and empty', () => {
  assert.equal(isValidUrl(''), false);
  assert.equal(isValidUrl('ftp://x.com'), false);
  assert.equal(isValidUrl('not a url'), false);
  assert.equal(isValidUrl('https://example.com'), true);
  assert.equal(isValidUrl('http://example.com'), true);
});

test('FR-041: host case, default port, single trailing slash are the SAME', () => {
  const a = normalizeKey('https://Example.com/path/');
  const b = normalizeKey('https://example.com:443/path');
  assert.equal(a, b);

  const c = normalizeKey('http://Example.com:80/');
  const d = normalizeKey('http://example.com/');
  assert.equal(c, d);
});

test('FR-041: differing fragment or query are DIFFERENT bookmarks', () => {
  assert.notEqual(
    normalizeKey('https://example.com/a#one'),
    normalizeKey('https://example.com/a#two')
  );
  assert.notEqual(
    normalizeKey('https://example.com/a?x=1'),
    normalizeKey('https://example.com/a?x=2')
  );
  // Query present vs absent are different.
  assert.notEqual(
    normalizeKey('https://example.com/a?x=1'),
    normalizeKey('https://example.com/a')
  );
});

test('FR-041: query and fragment preserved, not stripped', () => {
  const key = normalizeKey('https://example.com/a?utm_source=x#sec');
  assert.match(key, /utm_source=x/);
  assert.match(key, /#sec/);
});

test('isPdfUrl detects .pdf paths', () => {
  assert.equal(isPdfUrl('https://x.com/file.pdf'), true);
  assert.equal(isPdfUrl('https://x.com/page'), false);
});
