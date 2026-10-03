import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeUrl, InvalidUrlError } from '../../src/lib/url.js';

test('accepts a full https url unchanged in host', () => {
  assert.equal(normalizeUrl('https://example.com/article'), 'https://example.com/article');
});

test('accepts http urls', () => {
  assert.equal(normalizeUrl('http://example.com/'), 'http://example.com/');
});

test('prepends https:// to scheme-less input', () => {
  assert.equal(normalizeUrl('example.com'), 'https://example.com/');
});

test('trims surrounding whitespace', () => {
  assert.equal(normalizeUrl('  example.com/path  '), 'https://example.com/path');
});

test('rejects empty input', () => {
  assert.throws(() => normalizeUrl('   '), InvalidUrlError);
});

test('rejects non-http schemes', () => {
  assert.throws(() => normalizeUrl('ftp://example.com'), InvalidUrlError);
  assert.throws(() => normalizeUrl('javascript:alert(1)'), InvalidUrlError);
});

test('rejects input without a dotted hostname', () => {
  assert.throws(() => normalizeUrl('not a url'), InvalidUrlError);
  assert.throws(() => normalizeUrl('localhost'), InvalidUrlError);
});
