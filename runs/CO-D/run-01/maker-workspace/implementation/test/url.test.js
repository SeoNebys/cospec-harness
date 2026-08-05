import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ensureScheme, isUrlLike, dedupeKey, hostOf } from '../src/core/url.js';

// SCN-001: a link without a leading scheme is still accepted
test('ensureScheme adds https:// when missing', () => {
  assert.equal(ensureScheme('example.com'), 'https://example.com');
  assert.equal(ensureScheme('http://example.com'), 'http://example.com');
  assert.equal(ensureScheme('  example.com  '), 'https://example.com');
  assert.equal(ensureScheme(''), '');
});

// Edge: non-links are refused (save-flow edge case)
test('isUrlLike rejects non-links', () => {
  assert.equal(isUrlLike('https://example.com'), true);
  assert.equal(isUrlLike('https://grocery list'), false); // space in host
  assert.equal(isUrlLike('https://example'), false); // no dot
  assert.equal(isUrlLike('not a url'), false);
});

// SCN-004: www. and trailing slash are the same page; tracking params are NOT
// yet normalized (parked), so different query strings stay different pages.
test('dedupeKey treats www and trailing slash as the same page', () => {
  assert.equal(
    dedupeKey('https://example.com/article'),
    dedupeKey('https://www.example.com/article/'),
  );
});

test('dedupeKey keeps genuinely different query strings distinct', () => {
  assert.notEqual(dedupeKey('https://ex.com/p?id=1'), dedupeKey('https://ex.com/p?id=2'));
});

test('dedupeKey: tracking params are NOT collapsed yet (parked behaviour)', () => {
  // Documents current approved behaviour: a ?utm variant is still a different key.
  assert.notEqual(
    dedupeKey('https://ex.com/a'),
    dedupeKey('https://ex.com/a?utm_source=news'),
  );
});

test('dedupeKey ignores the #fragment (same page)', () => {
  assert.equal(dedupeKey('https://ex.com/a#top'), dedupeKey('https://ex.com/a'));
});

test('hostOf strips www', () => {
  assert.equal(hostOf('https://www.example.com/x'), 'example.com');
});
