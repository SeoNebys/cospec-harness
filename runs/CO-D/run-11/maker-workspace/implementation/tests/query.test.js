'use strict';
var test = require('node:test');
var assert = require('node:assert');
var Q = require('../lib/query');

var items = [
  { title: 'Mars Exploration', description: 'rovers and orbiters', note: '', url: 'https://nasa.gov/mars', tags: ['space', 'to-read'] },
  { title: 'Python Decorators', description: 'wrap functions', note: 'read before meeting', url: 'https://realpython.com/dec', tags: ['python', 'to-read'] },
  { title: 'Perfect Pasta', description: 'cook pasta properly', note: '', url: 'https://seriouseats.com/pasta', tags: ['cooking'] }
];
function run(q) { return items.filter(function (it) { return Q.matches(it, q); }); }

test('case-insensitive word match', function () {
  assert.equal(run('PASTA').length, 1);
  assert.equal(run('pasta').length, 1);
});
test('multiple bare words require all', function () {
  assert.equal(run('cook pasta').length, 1);
  assert.equal(run('cook rovers').length, 0);
});
test('#tag matches tag only', function () {
  assert.equal(run('#python').length, 1);
  assert.equal(run('#to-read').length, 2);
});
test('exact phrase', function () {
  assert.equal(run('"perfect pasta"').length, 1);
  assert.equal(run('"pasta perfect"').length, 0);
});
test('boolean OR / NOT / grouping', function () {
  assert.equal(run('#python OR #cooking').length, 2);
  assert.equal(run('NOT #to-read').length, 1);
  assert.equal(run('rovers AND (#space OR #cooking)').length, 1);
});
test('operators are case-insensitive', function () {
  assert.equal(run('#python or #cooking').length, 2);
});
test('quoted operator is literal', function () {
  // "and" appears in "rovers and orbiters"
  assert.equal(run('"and"').length, 1);
});
test('note is searched', function () {
  assert.equal(run('meeting').length, 1);
});
test('malformed query falls back to plain words', function () {
  // unbalanced paren -> plain search of meaningful words -> "python"
  assert.equal(run('((#python').length, 1);
});
test('terms() returns highlightable words, not tags', function () {
  var t = Q.terms('#python pasta "cook it"');
  assert.ok(t.indexOf('pasta') >= 0);
  assert.ok(t.indexOf('cook it') >= 0);
  assert.ok(t.indexOf('python') < 0);
});
