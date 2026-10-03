import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeUrl, InvalidUrlError } from '../../src/server/services/normalizeUrl.js';

test('defaults a missing scheme to https', () => {
  const { normalized } = normalizeUrl('example.com');
  assert.equal(normalized, 'https://example.com');
});

test('removes a redundant trailing slash on a path-less URL', () => {
  assert.equal(normalizeUrl('https://example.com/').normalized, 'https://example.com');
});

test('lowercases scheme and host but preserves path case', () => {
  const { normalized } = normalizeUrl('HTTPS://Example.COM/Path/To');
  assert.equal(normalized, 'https://example.com/Path/To');
});

test('treats trivial variants as the same normalized address', () => {
  const a = normalizeUrl('example.com').normalized;
  const b = normalizeUrl('https://example.com/').normalized;
  const c = normalizeUrl('HTTPS://EXAMPLE.COM').normalized;
  assert.equal(a, b);
  assert.equal(b, c);
});

test('keeps query and fragment', () => {
  assert.equal(normalizeUrl('https://example.com/a?x=1#frag').normalized, 'https://example.com/a?x=1#frag');
});

test('rejects empty input', () => {
  assert.throws(() => normalizeUrl(''), InvalidUrlError);
  assert.throws(() => normalizeUrl('   '), InvalidUrlError);
});

test('rejects malformed / non-web input', () => {
  assert.throws(() => normalizeUrl('mailto:a@b.com'), InvalidUrlError);
  assert.throws(() => normalizeUrl('not a url'), InvalidUrlError);
  assert.throws(() => normalizeUrl('http://nohost'), InvalidUrlError);
});
