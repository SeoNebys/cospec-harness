import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractTitle, fetchTitle } from '../../src/title-fetch.js';

test('extractTitle pulls and trims the <title> text', () => {
  assert.equal(extractTitle('<html><head><title>  Hello  World </title></head>'), 'Hello World');
});

test('extractTitle decodes basic HTML entities', () => {
  assert.equal(extractTitle('<title>Tom &amp; Jerry &#39;99</title>'), "Tom & Jerry '99");
});

test('extractTitle returns null when no title present', () => {
  assert.equal(extractTitle('<html><head></head></html>'), null);
  assert.equal(extractTitle('<title></title>'), null);
});

test('fetchTitle returns null on an unreachable host (graceful fallback, FR-004)', async () => {
  // Reserved TEST-NET-1 address that should not answer; must resolve to null, not throw.
  const result = await fetchTitle('http://192.0.2.1:9/');
  assert.equal(result, null);
});
