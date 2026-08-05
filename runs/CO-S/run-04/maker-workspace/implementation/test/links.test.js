'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const {
  looksLikeUrl, normalizeUrl, sameLink, extractTitle, fallbackName, withScheme,
} = require('../src/links');

test('looksLikeUrl: accepts things that look like links (SCN-007)', () => {
  assert.equal(looksLikeUrl('https://example.com/page'), true);
  assert.equal(looksLikeUrl('example.com'), true);
  assert.equal(looksLikeUrl('sub.example.co.uk/a/b'), true);
});

test('looksLikeUrl: rejects free text (SCN-007)', () => {
  assert.equal(looksLikeUrl('dinner ideas'), false);
  assert.equal(looksLikeUrl('buy milk'), false);
  assert.equal(looksLikeUrl('reminder'), false); // no dot
  assert.equal(looksLikeUrl(''), false);
  assert.equal(looksLikeUrl('   '), false);
});

test('normalizeUrl: ignores scheme, trailing slash and case (SCN-008)', () => {
  assert.equal(normalizeUrl('HTTPS://Example.com/Page/'), normalizeUrl('http://example.com/Page'.toLowerCase()));
  assert.equal(normalizeUrl('https://example.com/'), 'example.com');
  assert.equal(normalizeUrl('example.com'), 'example.com');
});

test('sameLink: detects duplicates across trivial differences (SCN-008)', () => {
  assert.equal(sameLink('https://coffeeweekly.com/perfect-espresso', 'http://coffeeweekly.com/perfect-espresso/'), true);
  assert.equal(sameLink('https://a.com/x', 'https://a.com/y'), false);
});

test('extractTitle: pulls and cleans the <title> (SCN-001)', () => {
  assert.equal(extractTitle('<html><head><title>  Hello  World </title></head></html>'), 'Hello World');
  assert.equal(extractTitle('<title>Tom &amp; Jerry</title>'), 'Tom & Jerry');
  assert.equal(extractTitle('<TITLE>Caps</TITLE>'), 'Caps');
});

test('extractTitle: returns null when there is no usable title (SCN-006)', () => {
  assert.equal(extractTitle('<html><head></head></html>'), null);
  assert.equal(extractTitle('<title>   </title>'), null);
  assert.equal(extractTitle(''), null);
  assert.equal(extractTitle(null), null);
});

test('fallbackName: the address stands in for the name (SCN-006)', () => {
  assert.equal(fallbackName('https://no-title.example.com/x'), 'https://no-title.example.com/x');
});

test('withScheme: adds https when missing', () => {
  assert.equal(withScheme('example.com'), 'https://example.com');
  assert.equal(withScheme('http://example.com'), 'http://example.com');
});
