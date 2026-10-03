import test from 'node:test';
import assert from 'node:assert/strict';
import { duplicateKey, parseWebUrl } from '../lib/urls.js';

test('accepts complete HTTP addresses', () => assert.equal(parseWebUrl('https://example.com/a').hostname, 'example.com'));
test('rejects malformed and non-web addresses', () => {
  assert.throws(() => parseWebUrl('not a web address'));
  assert.throws(() => parseWebUrl('file:///etc/passwd'));
});
test('duplicate identity ignores tracking, fragments, and trailing slash', () => {
  const clean = duplicateKey('https://example.com/article');
  assert.equal(duplicateKey('https://example.com/article/?utm_source=mail&gclid=abc#part'), clean);
  assert.notEqual(duplicateKey('https://example.com/article?page=2'), clean);
});
