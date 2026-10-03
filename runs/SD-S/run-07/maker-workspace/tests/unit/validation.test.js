import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isValidUrl, normalizeUrl } from '../../src/models/bookmark.js';

test('isValidUrl rejects empty and whitespace', () => {
  assert.equal(isValidUrl(''), false);
  assert.equal(isValidUrl('   '), false);
  assert.equal(isValidUrl(undefined), false);
});

test('isValidUrl rejects malformed and non-http(s) addresses', () => {
  assert.equal(isValidUrl('not a url'), false);
  assert.equal(isValidUrl('example.com'), false); // no scheme
  assert.equal(isValidUrl('ftp://example.com'), false);
  assert.equal(isValidUrl('javascript:alert(1)'), false);
});

test('isValidUrl accepts well-formed http and https addresses', () => {
  assert.equal(isValidUrl('http://example.com'), true);
  assert.equal(isValidUrl('https://example.com/path?q=1'), true);
  assert.equal(isValidUrl('  https://example.com/x  '), true);
});

test('normalizeUrl trims, lowercases scheme/host, strips trailing slash', () => {
  assert.equal(normalizeUrl('  HTTPS://Example.COM/  '), 'https://example.com');
  assert.equal(normalizeUrl('https://example.com'), 'https://example.com');
  assert.equal(
    normalizeUrl('https://Example.com/Path/'),
    'https://example.com/Path'
  );
});

test('normalizeUrl treats trailing-slash and case variants as equal', () => {
  assert.equal(
    normalizeUrl('http://Example.com/a/'),
    normalizeUrl('HTTP://example.com/a')
  );
});

test('normalizeUrl preserves query and fragment', () => {
  assert.equal(
    normalizeUrl('https://example.com/search?q=cats#top'),
    'https://example.com/search?q=cats#top'
  );
});
