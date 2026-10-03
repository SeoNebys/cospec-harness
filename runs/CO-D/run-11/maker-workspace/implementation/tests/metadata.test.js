'use strict';
var test = require('node:test');
var assert = require('node:assert');
var meta = require('../lib/metadata');
var urls = require('../lib/urls');

test('extract prefers og:title and og:description', function () {
  var html = '<html><head><title>Fallback</title>' +
    '<meta property="og:title" content="Real Title">' +
    '<meta property="og:description" content="A description">' +
    '<meta property="og:image" content="/img/hero.png"></head><body></body></html>';
  var m = meta.extract(html, 'https://example.com/page');
  assert.equal(m.title, 'Real Title');
  assert.equal(m.description, 'A description');
  assert.equal(m.image, 'https://example.com/img/hero.png');
  assert.ok(m.icon.indexOf('example.com') >= 0);
});
test('extract falls back to <title> then host', function () {
  var m1 = meta.extract('<title>Just Title</title>', 'https://example.com/');
  assert.equal(m1.title, 'Just Title');
  var m2 = meta.extract('<html></html>', 'https://example.com/');
  assert.equal(m2.title, 'Example.com');
});
test('fallback builds host title and favicon', function () {
  var f = meta.fallback('https://www.nasa.gov/mars');
  assert.equal(f.title, 'Nasa.gov');
  assert.equal(f.description, '');
  assert.equal(f.image, '');
});
test('url helpers', function () {
  assert.equal(urls.normalize('example.com/a/'), 'https://example.com/a');
  assert.equal(urls.isValid('https://example.com/a'), true);
  assert.equal(urls.isValid('not a url'), false);
  assert.equal(urls.isValid('https://nodot'), false);
  assert.equal(urls.isPdf('https://x.com/a.pdf'), true);
  assert.equal(urls.isPdf('https://x.com/a.pdf?x=1'), true);
  assert.equal(urls.isPdf('https://x.com/a'), false);
});
