const test = require('node:test');
const assert = require('node:assert');
const { normalizeUrl, dupKey, preferHttps } = require('../../lib/normalize');

// SCN-001 / SCN-011
test('adds https scheme when missing', () => {
  assert.equal(normalizeUrl('example.com/x').href, 'https://example.com/x');
});
test('rejects empty and invalid', () => {
  assert.equal(normalizeUrl(''), null);
  assert.equal(normalizeUrl('   '), null);
  assert.equal(normalizeUrl('not a url with spaces and no dot'), null);
});

// SCN-012
test('dupKey ignores trailing slash', () => {
  assert.equal(dupKey('https://site.com/page'), dupKey('https://site.com/page/'));
});
test('dupKey is scheme-insensitive', () => {
  assert.equal(dupKey('http://site.com/page'), dupKey('https://site.com/page'));
});
test('dupKey strips www and lowercases host', () => {
  assert.equal(dupKey('https://WWW.Site.com/page'), dupKey('https://site.com/page'));
});
test('dupKey keeps query string significant', () => {
  assert.notEqual(dupKey('https://site.com/p?a=1'), dupKey('https://site.com/p?a=2'));
});
test('preferHttps upgrades http existing to incoming https', () => {
  assert.equal(preferHttps('http://s.com/p', 'https://s.com/p'), 'https://s.com/p');
  assert.equal(preferHttps('https://s.com/p', 'http://s.com/p'), 'https://s.com/p');
});
