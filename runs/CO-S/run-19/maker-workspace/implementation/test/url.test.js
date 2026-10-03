import assert from 'node:assert/strict';
import test from 'node:test';
import { InvalidUrlError, canonicalizeUrl, displayHost, parseWebUrl } from '../src/url.js';

test('complete http and https addresses are accepted and display without www', () => {
  assert.equal(parseWebUrl(' https://www.Example.com/article ').hostname, 'www.example.com');
  assert.equal(parseWebUrl('http://example.com').protocol, 'http:');
  assert.equal(displayHost('https://www.example.com/path'), 'example.com');
});

test('incomplete text and unsafe schemes are rejected with a nearby-useful message', () => {
  for (const value of ['this is not a link', 'example.com/page', 'javascript:alert(1)', 'ftp://example.com']) {
    assert.throws(() => parseWebUrl(value), (error) => {
      assert.ok(error instanceof InvalidUrlError);
      assert.match(error.message, /https:\/\/example\.com\/article/);
      return true;
    });
  }
});

test('canonical addresses ignore tracking, fragments, parameter order, and trailing slash noise', () => {
  const original = canonicalizeUrl('https://Example.com/story/?b=2&a=1#comments');
  const tracked = canonicalizeUrl('https://example.com/story?a=1&utm_source=newsletter&fbclid=abc&b=2');
  assert.equal(original, 'https://example.com/story?a=1&b=2');
  assert.equal(tracked, original);
});
