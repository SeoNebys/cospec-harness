import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeUrl, InvalidUrlError } from '../src/services/url.js';

test('adds https scheme when missing', () => {
  const { url } = normalizeUrl('example.com/path');
  assert.equal(url, 'https://example.com/path');
});

test('rejects non-http schemes', () => {
  assert.throws(() => normalizeUrl('mailto:a@b.com'), InvalidUrlError);
  assert.throws(() => normalizeUrl('javascript:alert(1)'), InvalidUrlError);
});

test('rejects empty input', () => {
  assert.throws(() => normalizeUrl(''), InvalidUrlError);
  assert.throws(() => normalizeUrl('   '), InvalidUrlError);
});

test('lower-cases host and strips fragment', () => {
  const { url } = normalizeUrl('HTTPS://Example.COM/Path#section');
  assert.equal(url, 'https://example.com/Path');
});

test('duplicate key ignores fragment and default port, sorts query', () => {
  const a = normalizeUrl('https://example.com:443/a?b=2&a=1#x');
  const b = normalizeUrl('example.com/a?a=1&b=2');
  assert.equal(a.urlKey, b.urlKey);
});

test('different query values yield different keys', () => {
  const a = normalizeUrl('https://example.com/a?x=1');
  const b = normalizeUrl('https://example.com/a?x=2');
  assert.notEqual(a.urlKey, b.urlKey);
});
