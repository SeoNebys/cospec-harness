import test from 'node:test';
import assert from 'node:assert/strict';
import { InvalidUrlError, normalizeUrl, parseWebUrl } from '../lib/url.js';

test('normalization removes section jumps and common tracking additions', () => {
  const clean = normalizeUrl('https://Example.com/article?utm_source=mail&fbclid=abc#comments');
  assert.equal(clean, 'https://example.com/article');
});

test('normalization preserves query values that can change page content', () => {
  assert.notEqual(
    normalizeUrl('https://example.com/search?q=potatoes&page=1'),
    normalizeUrl('https://example.com/search?q=potatoes&page=2')
  );
});

test('normalization treats reordered meaningful query values consistently', () => {
  assert.equal(
    normalizeUrl('https://example.com/search?sort=new&q=work'),
    normalizeUrl('https://example.com/search?q=work&sort=new')
  );
});

test('incomplete and non-web addresses are rejected without guessing', () => {
  assert.throws(() => parseWebUrl('example.com/page'), InvalidUrlError);
  assert.throws(() => parseWebUrl('file:///etc/passwd'), InvalidUrlError);
  assert.throws(() => parseWebUrl('https://user:secret@example.com'), InvalidUrlError);
});

