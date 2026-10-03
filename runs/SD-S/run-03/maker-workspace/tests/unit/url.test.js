import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeUrl, isValidUrl, InvalidUrlError } from '../../server/lib/url.js';

test('accepts valid http and https URLs', () => {
  assert.equal(isValidUrl('https://example.com'), true);
  assert.equal(isValidUrl('http://example.com/path?q=1'), true);
});

test('rejects malformed input', () => {
  assert.equal(isValidUrl('not a url'), false);
  assert.equal(isValidUrl(''), false);
  assert.equal(isValidUrl('   '), false);
});

test('rejects non-http(s) schemes', () => {
  assert.equal(isValidUrl('ftp://example.com'), false);
  assert.equal(isValidUrl('file:///etc/hosts'), false);
  assert.equal(isValidUrl('javascript:alert(1)'), false);
});

test('throws InvalidUrlError with code for bad input', () => {
  assert.throws(() => normalizeUrl('nope'), (err) => {
    assert.ok(err instanceof InvalidUrlError);
    assert.equal(err.code, 'invalid_url');
    return true;
  });
});

test('normalizes host casing', () => {
  assert.equal(normalizeUrl('https://EXAMPLE.com/A'), 'https://example.com/A');
});

test('strips default ports', () => {
  assert.equal(normalizeUrl('http://example.com:80/'), 'http://example.com/');
  assert.equal(normalizeUrl('https://example.com:443/'), 'https://example.com/');
});

test('keeps non-default ports', () => {
  assert.equal(normalizeUrl('http://example.com:8080/'), 'http://example.com:8080/');
});

test('collapses empty path to /', () => {
  assert.equal(normalizeUrl('https://example.com'), 'https://example.com/');
});

test('trims surrounding whitespace', () => {
  assert.equal(normalizeUrl('  https://example.com/  '), 'https://example.com/');
});
