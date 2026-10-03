import test from 'node:test';
import assert from 'node:assert/strict';
import { canonicalizeAddress, cleanDisplayAddress, InvalidAddressError, tidyLabel, websiteName } from '../../lib/urls.js';

test('validates and cleans display addresses', () => {
  assert.equal(cleanDisplayAddress(' https://Example.com/article#section '), 'https://example.com/article');
  assert.equal(websiteName('https://www.Example.com/a'), 'example.com');
  assert.throws(() => cleanDisplayAddress('not a link'), InvalidAddressError);
  assert.throws(() => cleanDisplayAddress('file:///tmp/a'), InvalidAddressError);
});

test('canonicalizes harmless URL differences and tracking parameters', () => {
  const clean = canonicalizeAddress('https://www.example.com/article/');
  const tracked = canonicalizeAddress('https://example.com/article?utm_source=newsletter&utm_campaign=weekly#intro');
  assert.equal(clean, 'https://example.com/article');
  assert.equal(tracked, clean);
});

test('preserves meaningful query parameters', () => {
  assert.notEqual(
    canonicalizeAddress('https://example.com/search?q=one'),
    canonicalizeAddress('https://example.com/search?q=two')
  );
});

test('tidies label spacing and initial capitalization', () => {
  assert.equal(tidyLabel('  project   planning '), 'Project planning');
  assert.equal(tidyLabel(''), '');
});
