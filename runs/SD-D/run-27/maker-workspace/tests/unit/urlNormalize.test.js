import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canonicalKey, isValidHttpUrl, titleFromUrl } from '../../server/lib/urlNormalize.js';

test('valid/invalid URLs', () => {
  assert.ok(isValidHttpUrl('http://example.com'));
  assert.ok(isValidHttpUrl('https://example.com/path?x=1'));
  assert.ok(!isValidHttpUrl('not a url'));
  assert.ok(!isValidHttpUrl('ftp://example.com'));
  assert.ok(!isValidHttpUrl(''));
});

test('safe-equivalence: host case collapses', () => {
  assert.equal(canonicalKey('http://Example.COM/Path'), canonicalKey('http://example.com/Path'));
});

test('safe-equivalence: default port dropped', () => {
  assert.equal(canonicalKey('http://example.com:80/'), canonicalKey('http://example.com/'));
  assert.equal(canonicalKey('https://example.com:443/a'), canonicalKey('https://example.com/a'));
});

test('trailing slash is NOT collapsed (kept distinct)', () => {
  assert.notEqual(canonicalKey('http://example.com/a'), canonicalKey('http://example.com/a/'));
});

test('query/tracking params are NOT stripped (kept distinct)', () => {
  assert.notEqual(canonicalKey('http://example.com/a'), canonicalKey('http://example.com/a?utm_source=x'));
  assert.notEqual(canonicalKey('http://example.com/a?b=1'), canonicalKey('http://example.com/a?b=2'));
});

test('non-default port preserved', () => {
  assert.notEqual(canonicalKey('http://example.com:8080/'), canonicalKey('http://example.com/'));
});

test('titleFromUrl derives host+path', () => {
  assert.equal(titleFromUrl('https://example.com/docs'), 'example.com/docs');
});
