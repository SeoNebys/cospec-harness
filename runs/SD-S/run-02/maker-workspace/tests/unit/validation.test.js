import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isValidHttpUrl, normalizeUrl, deriveTitleFromUrl } from '../../src/validation.js';

test('isValidHttpUrl accepts http and https', () => {
  assert.ok(isValidHttpUrl('http://example.com'));
  assert.ok(isValidHttpUrl('https://example.com/path?q=1'));
});

test('isValidHttpUrl rejects invalid or non-web schemes', () => {
  assert.equal(isValidHttpUrl(''), false);
  assert.equal(isValidHttpUrl('   '), false);
  assert.equal(isValidHttpUrl('not a url'), false);
  assert.equal(isValidHttpUrl('ftp://example.com'), false);
  assert.equal(isValidHttpUrl('javascript:alert(1)'), false);
  assert.equal(isValidHttpUrl(null), false);
});

test('normalizeUrl treats trailing slash and default port as equivalent', () => {
  assert.equal(normalizeUrl('http://Example.com'), normalizeUrl('http://example.com/'));
  assert.equal(normalizeUrl('https://example.com:443/'), normalizeUrl('https://example.com'));
  assert.equal(normalizeUrl('http://example.com:80'), normalizeUrl('http://example.com/'));
});

test('normalizeUrl preserves path and query, drops fragment', () => {
  assert.equal(normalizeUrl('https://x.com/a/b?c=1#frag'), 'https://x.com/a/b?c=1');
});

test('normalizeUrl throws on invalid url', () => {
  assert.throws(() => normalizeUrl('nope'), /invalid_url/);
});

test('deriveTitleFromUrl uses last path segment or hostname', () => {
  assert.equal(deriveTitleFromUrl('https://example.com/articles/hello-world'), 'hello-world');
  assert.equal(deriveTitleFromUrl('https://example.com'), 'example.com');
  assert.equal(deriveTitleFromUrl('https://example.com/'), 'example.com');
});
