import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateAndNormalize, InvalidUrlError } from '../../src/services/url.js';

test('scheme-less input defaults to https', () => {
  const { url, normalizedUrl } = validateAndNormalize('example.com');
  assert.equal(url, 'https://example.com/');
  assert.equal(normalizedUrl, 'https://example.com');
});

test('preserves path and query', () => {
  const { normalizedUrl } = validateAndNormalize('example.com/foo?a=1');
  assert.equal(normalizedUrl, 'https://example.com/foo?a=1');
});

test('normalization treats host casing and default port as equal', () => {
  const a = validateAndNormalize('HTTP://Example.com:80/').normalizedUrl;
  const b = validateAndNormalize('http://example.com').normalizedUrl;
  assert.equal(a, b);
  assert.equal(a, 'http://example.com');
});

test('trailing slash on empty path is dropped', () => {
  assert.equal(
    validateAndNormalize('https://example.com/').normalizedUrl,
    'https://example.com'
  );
});

test('rejects non-http protocols', () => {
  assert.throws(() => validateAndNormalize('ftp://example.com'), InvalidUrlError);
  assert.throws(() => validateAndNormalize('javascript:alert(1)'), InvalidUrlError);
});

test('rejects empty and malformed input', () => {
  assert.throws(() => validateAndNormalize(''), InvalidUrlError);
  assert.throws(() => validateAndNormalize('   '), InvalidUrlError);
  assert.throws(() => validateAndNormalize('not a url'), InvalidUrlError);
  assert.throws(() => validateAndNormalize(null), InvalidUrlError);
});
