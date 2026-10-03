import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalize, dedupeKey } from '../../src/url.js';

test('normalize prepends https:// when no scheme present (FR-003)', () => {
  assert.equal(normalize('example.com'), 'https://example.com/');
  assert.equal(normalize('example.com/page'), 'https://example.com/page');
});

test('normalize keeps existing http/https scheme', () => {
  assert.equal(normalize('http://example.com/a'), 'http://example.com/a');
  assert.equal(normalize('https://example.com/a'), 'https://example.com/a');
});

test('normalize trims surrounding whitespace', () => {
  assert.equal(normalize('  example.com  '), 'https://example.com/');
});

test('normalize rejects empty input (FR-002)', () => {
  assert.throws(() => normalize(''), /enter a web address/i);
  assert.throws(() => normalize('   '), /enter a web address/i);
});

test('normalize rejects non-url text (FR-002)', () => {
  assert.throws(() => normalize('not a url'), /valid web address/i);
  assert.throws(() => normalize('justtext'), /valid web address/i);
});

test('normalize rejects non-http schemes', () => {
  assert.throws(() => normalize('ftp://example.com'), /http and https/i);
  assert.throws(() => normalize('javascript:alert(1)'), /http and https/i);
});

test('dedupeKey ignores scheme, query, fragment, and trailing slash (FR-010)', () => {
  const a = dedupeKey(normalize('https://Example.com/page/'));
  const b = dedupeKey(normalize('http://example.com/page'));
  const c = dedupeKey(normalize('example.com/page?x=1#frag'));
  assert.equal(a, 'example.com/page');
  assert.equal(a, b);
  assert.equal(a, c);
});

test('dedupeKey distinguishes different paths', () => {
  assert.notEqual(
    dedupeKey(normalize('example.com/a')),
    dedupeKey(normalize('example.com/b'))
  );
});
