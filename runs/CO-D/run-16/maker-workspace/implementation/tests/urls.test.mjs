import test from 'node:test';
import assert from 'node:assert/strict';
import { isValidUrl, normalizeUrl, domainOf, detectFileKind, detectFileKindFromUrl } from '../src/urls.js';

test('isValidUrl accepts addresses, rejects non-addresses (SCN-012)', () => {
  assert.equal(isValidUrl('nytimes.com'), true);
  assert.equal(isValidUrl('http://a.com/rome'), true);
  assert.equal(isValidUrl('example.co.uk'), true);
  assert.equal(isValidUrl('fail.example.com'), true); // valid address, fetch may fail
  assert.equal(isValidUrl('just some text'), false);
  assert.equal(isValidUrl('hello'), false);
  assert.equal(isValidUrl(''), false);
});

test('normalizeUrl matches duplicates ignoring scheme/www/trailing slash (SCN-003/005)', () => {
  assert.equal(normalizeUrl('https://www.a.com/'), normalizeUrl('a.com'));
  assert.equal(normalizeUrl('http://A.com/path/'), 'a.com/path');
});

test('domainOf extracts host', () => {
  assert.equal(domainOf('https://www.example.com/x/y'), 'example.com');
});

test('detectFileKind uses content type, falls back to url (SCN-020)', () => {
  assert.equal(detectFileKind('application/pdf', 'x.com/a'), 'pdf');
  assert.equal(detectFileKind('text/html', 'x.com/a.pdf'), 'page');
  assert.equal(detectFileKindFromUrl('site.com/report.pdf?dl=1'), 'pdf');
  assert.equal(detectFileKindFromUrl('site.com/report.pdf/view'), 'pdf');
  assert.equal(detectFileKindFromUrl('site.com/files/pdf/x'), 'pdf');
  assert.equal(detectFileKindFromUrl('nytimes.com/article'), 'page');
});
