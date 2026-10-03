import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  canonicalKey,
  isValidHttpUrl,
  deriveTitleFromUrl,
} from '../../src/services/normalize.js';

test('trailing slash is ignored', () => {
  assert.equal(
    canonicalKey('https://example.com/page/'),
    canonicalKey('https://example.com/page')
  );
});

test('host case is ignored', () => {
  assert.equal(
    canonicalKey('https://Example.COM/Path'),
    canonicalKey('https://example.com/Path')
  );
});

test('scheme case is ignored', () => {
  assert.equal(
    canonicalKey('HTTPS://example.com/'),
    canonicalKey('https://example.com/')
  );
});

test('default port stripped, non-default kept', () => {
  assert.equal(
    canonicalKey('https://example.com:443/x'),
    canonicalKey('https://example.com/x')
  );
  assert.notEqual(
    canonicalKey('https://example.com:8443/x'),
    canonicalKey('https://example.com/x')
  );
});

test('tracking params dropped, others preserved and sorted', () => {
  assert.equal(
    canonicalKey('https://e.com/a?utm_source=x&b=2&a=1&fbclid=z'),
    canonicalKey('https://e.com/a?a=1&b=2')
  );
});

test('different paths are distinct', () => {
  assert.notEqual(
    canonicalKey('https://e.com/a'),
    canonicalKey('https://e.com/b')
  );
});

test('invalid urls rejected', () => {
  assert.equal(isValidHttpUrl(''), false);
  assert.equal(isValidHttpUrl('not a url'), false);
  assert.equal(isValidHttpUrl('ftp://e.com'), false);
  assert.equal(isValidHttpUrl('https://e.com'), true);
  assert.throws(() => canonicalKey('nope'));
});

test('derive title from url', () => {
  assert.match(
    deriveTitleFromUrl('https://example.com/my-cool-article'),
    /my cool article/
  );
  assert.equal(deriveTitleFromUrl('https://example.com/'), 'example.com');
});
