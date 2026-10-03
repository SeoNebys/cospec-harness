import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalize, deriveTitle, ValidationError } from '../../server/services/url.js';

test('adds https scheme when missing', () => {
  assert.equal(normalize('example.com'), 'https://example.com');
});

test('lowercases host but preserves path case', () => {
  assert.equal(normalize('HTTPS://Example.COM/Path'), 'https://example.com/Path');
});

test('strips default ports', () => {
  assert.equal(normalize('http://example.com:80/'), 'http://example.com');
  assert.equal(normalize('https://example.com:443/'), 'https://example.com');
});

test('drops trailing slash (trivial variant) on root and sub-paths', () => {
  assert.equal(normalize('https://example.com/'), 'https://example.com');
  assert.equal(normalize('https://example.com/a/'), 'https://example.com/a');
  // trailing slash before a query/fragment is left intact
  assert.equal(normalize('https://example.com/a/?q=1'), 'https://example.com/a/?q=1');
});

test('treats trailing-slash sub-path variants as duplicates', () => {
  assert.equal(normalize('https://example.com/climate-news/'), normalize('https://example.com/climate-news'));
});

test('preserves query and fragment', () => {
  assert.equal(normalize('https://example.com/?q=1#top'), 'https://example.com/?q=1#top');
});

test('treats scheme-less and prefixed variants as the same', () => {
  assert.equal(normalize('example.com'), normalize('https://example.com/'));
});

test('rejects empty input', () => {
  assert.throws(() => normalize('   '), ValidationError);
  assert.throws(() => normalize(''), ValidationError);
});

test('rejects non-http schemes', () => {
  assert.throws(() => normalize('ftp://example.com'), ValidationError);
  assert.throws(() => normalize('javascript:alert(1)'), ValidationError);
});

test('derives a readable fallback title', () => {
  assert.equal(deriveTitle('https://example.com'), 'example.com');
  assert.equal(
    deriveTitle('https://example.com/some-cool_article.html'),
    'some cool article — example.com',
  );
});
