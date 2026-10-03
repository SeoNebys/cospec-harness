'use strict';
var test = require('node:test');
var assert = require('node:assert');
var bf = require('../lib/bookmarkfile');

var SAMPLE = [
  '<!DOCTYPE NETSCAPE-Bookmark-file-1>',
  '<H1>Bookmarks</H1>',
  '<DL><p>',
  '  <DT><H3>Bookmarks bar</H3>',
  '  <DL><p>',
  '    <DT><H3>Programming</H3>',
  '    <DL><p>',
  '      <DT><H3>Python</H3>',
  '      <DL><p>',
  '        <DT><A HREF="https://ex.com/py" ADD_DATE="1600000000" TAGS="reference">Py &amp; more</A>',
  '        <DD>a note',
  '      </DL><p>',
  '    </DL><p>',
  '    <DT><A HREF="https://ex.com/root" ADD_DATE="1500000000">Root page</A>',
  '  </DL><p>',
  '</DL><p>'
].join('\n');

test('parse: titles, saved dates, tags', function () {
  var out = bf.parse(SAMPLE);
  assert.equal(out.length, 2);
  var py = out.find(function (x) { return x.url === 'https://ex.com/py'; });
  assert.equal(py.title, 'Py & more');
  assert.equal(py.addDate, 1600000000 * 1000);
  assert.equal(py.note, 'a note');
});
test('parse: nested folders become tags, generic containers excluded', function () {
  var out = bf.parse(SAMPLE);
  var py = out.find(function (x) { return x.url === 'https://ex.com/py'; });
  assert.deepEqual(py.tags.sort(), ['programming', 'python', 'reference'].sort());
  assert.ok(py.tags.indexOf('bookmarks bar') < 0);
});
test('parse: root-level page has no folder tags', function () {
  var out = bf.parse(SAMPLE);
  var root = out.find(function (x) { return x.url === 'https://ex.com/root'; });
  assert.deepEqual(root.tags, []);
});
test('generate then parse round-trips title/tags/date', function () {
  var bms = [{ url: 'https://a.com/x', title: 'Hello', tags: ['t1', 't2'], note: 'n', saved: 1600000000000, updated: 1600000000000 }];
  var file = bf.generate(bms);
  assert.ok(file.indexOf('TAGS="t1,t2"') >= 0);
  var out = bf.parse(file);
  assert.equal(out.length, 1);
  assert.equal(out[0].title, 'Hello');
  assert.deepEqual(out[0].tags.sort(), ['t1', 't2']);
  assert.equal(out[0].addDate, 1600000000000);
});
