import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isValidHttpUrl, canonicalKey, deriveTitle } from '../../src/lib/url.js';

test('valid and invalid URLs', () => {
  assert.ok(isValidHttpUrl('https://example.com'));
  assert.ok(isValidHttpUrl('http://example.com/path?q=1'));
  assert.ok(!isValidHttpUrl('not a url'));
  assert.ok(!isValidHttpUrl('ftp://example.com'));
  assert.ok(!isValidHttpUrl(''));
});

test('canonical key normalises host/port/trailing slash', () => {
  assert.equal(canonicalKey('https://Example.com/page/'), 'https://example.com/page');
  assert.equal(canonicalKey('https://example.com:443/page'), 'https://example.com/page');
  assert.equal(canonicalKey('https://example.com/page/'), canonicalKey('https://example.com/page'));
  assert.notEqual(canonicalKey('https://example.com/a'), canonicalKey('https://example.com/b'));
  // Fragments dropped, query preserved.
  assert.equal(canonicalKey('https://example.com/x?a=1#frag'), 'https://example.com/x?a=1');
});

test('derives a readable title from a URL', () => {
  assert.equal(deriveTitle('https://example.com/some/page'), 'example.com/some/page');
  assert.equal(deriveTitle('https://example.com'), 'example.com');
});
