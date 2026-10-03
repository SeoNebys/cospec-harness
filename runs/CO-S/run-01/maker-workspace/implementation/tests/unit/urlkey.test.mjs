import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sameKey, findExisting } from '../../public/js/urlkey.js';

test('SCN-002: same page ignoring protocol, www, trailing slash, host case', () => {
  const base = 'https://developer.mozilla.org/en-US/docs/Web/Array/map';
  assert.equal(sameKey(base), sameKey('http://developer.mozilla.org/en-US/docs/Web/Array/map'));
  assert.equal(sameKey(base), sameKey('https://www.developer.mozilla.org/en-US/docs/Web/Array/map'));
  assert.equal(sameKey(base), sameKey('https://developer.mozilla.org/en-US/docs/Web/Array/map/'));
  assert.equal(sameKey(base), sameKey('https://Developer.Mozilla.ORG/en-US/docs/Web/Array/map'));
});

test('SCN-002: different pages are not the same', () => {
  assert.notEqual(sameKey('https://a.com/x'), sameKey('https://a.com/y'));
  assert.notEqual(sameKey('https://a.com/x?q=1'), sameKey('https://a.com/x?q=2'));
});

test('SCN-002: findExisting returns the matching bookmark', () => {
  const list = [{ id: 1, url: 'https://a.com/x/' }, { id: 2, url: 'https://b.com/y' }];
  assert.equal(findExisting(list, 'http://www.a.com/x')?.id, 1);
  assert.equal(findExisting(list, 'https://c.com/z'), null);
});
