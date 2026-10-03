import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isValidWebUrl, normalizeUrl, titleFromUrl } from '../../src/util/url.js';

test('isValidWebUrl accepts http/https with a dotted host', () => {
  assert.ok(isValidWebUrl('https://example.com'));
  assert.ok(isValidWebUrl('http://example.com/path?x=1'));
  assert.ok(isValidWebUrl('https://sub.example.co.uk/a/b'));
});

test('isValidWebUrl rejects malformed or non-web addresses', () => {
  assert.equal(isValidWebUrl(''), false);
  assert.equal(isValidWebUrl('not a url'), false);
  assert.equal(isValidWebUrl('ftp://example.com'), false);
  assert.equal(isValidWebUrl('javascript:alert(1)'), false);
  assert.equal(isValidWebUrl('http://localhost'), false); // no dot in host
  assert.equal(isValidWebUrl(null), false);
});

test('normalizeUrl treats trailing slash, default port, and fragment as equal', () => {
  assert.equal(normalizeUrl('https://Example.com'), normalizeUrl('https://example.com/'));
  assert.equal(normalizeUrl('https://example.com:443/a/'), normalizeUrl('https://example.com/a'));
  assert.equal(normalizeUrl('http://example.com:80/a#frag'), normalizeUrl('http://example.com/a'));
});

test('normalizeUrl preserves the query string (different pages stay different)', () => {
  assert.notEqual(normalizeUrl('https://example.com/s?q=1'), normalizeUrl('https://example.com/s?q=2'));
});

test('titleFromUrl derives a readable title from the path or host', () => {
  assert.equal(titleFromUrl('https://example.com/my-great-article.html'), 'my great article');
  assert.equal(titleFromUrl('https://example.com'), 'example.com');
});
