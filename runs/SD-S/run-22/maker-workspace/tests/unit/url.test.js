import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeUrl, isValidUrl, fallbackTitle } from '../../src/services/url.js';

test('normalizeUrl assumes https when scheme missing', () => {
  assert.equal(normalizeUrl('example.com/article'), 'https://example.com/article');
});

test('normalizeUrl preserves an explicit http scheme', () => {
  assert.equal(normalizeUrl('http://example.com/'), 'http://example.com/');
});

test('normalizeUrl trims surrounding whitespace', () => {
  assert.equal(normalizeUrl('  example.com  '), 'https://example.com/');
});

test('normalizeUrl rejects empty and non-string input', () => {
  assert.equal(normalizeUrl(''), null);
  assert.equal(normalizeUrl('   '), null);
  assert.equal(normalizeUrl(null), null);
  assert.equal(normalizeUrl(undefined), null);
});

test('normalizeUrl rejects non-http(s) schemes', () => {
  assert.equal(normalizeUrl('ftp://example.com'), null);
  assert.equal(normalizeUrl('javascript:alert(1)'), null);
});

test('isValidUrl reflects normalization', () => {
  assert.equal(isValidUrl('example.com'), true);
  assert.equal(isValidUrl('https://example.com/path'), true);
  assert.equal(isValidUrl(''), false);
});

test('isValidUrl rejects a bare scheme with no host', () => {
  assert.equal(isValidUrl('https://'), false);
});

test('fallbackTitle uses host and path', () => {
  assert.equal(fallbackTitle('https://example.com/article'), 'example.com/article');
});

test('fallbackTitle for root path is just the host', () => {
  assert.equal(fallbackTitle('https://example.com/'), 'example.com');
});
