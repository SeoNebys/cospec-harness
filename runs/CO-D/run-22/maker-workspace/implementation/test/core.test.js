'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeUrl, compileSearch, sortBookmarks } = require('../core');

const bookmarks = [
  { title: 'Pasta for a dinner party', description: '', labels: ['Cooking', 'Weekend'], pageText: 'A visual hierarchy and flexbox primer', createdAt: '2025-02-01' },
  { title: 'Weeknight pasta guide', description: '', labels: ['Cooking'], pageText: '', createdAt: '2024-02-01' },
  { title: 'Rome pasta list', description: '', labels: ['Travel'], pageText: '', createdAt: '2026-02-01' },
  { title: 'And Then There Were None', description: '', labels: ['Books'], pageText: '', createdAt: '2023-02-01' }
];

test('normalizes tracking and fragments but preserves meaningful parameters', () => {
  assert.equal(normalizeUrl('HTTPS://Example.com/page/?utm_source=x&chapter=2#part'), 'https://example.com/page?chapter=2');
  assert.notEqual(normalizeUrl('https://example.com/page?chapter=2'), normalizeUrl('https://example.com/page?chapter=3'));
});
test('search is case insensitive and finds captured text', () => assert.equal(compileSearch('Flexbox').test(bookmarks[0]), true));
test('unquoted labels use OR while text remains required', () => {
  const search = compileSearch('pasta #cooking #weekend');
  assert.deepEqual(bookmarks.filter(search.test).map(x => x.title), ['Pasta for a dinner party', 'Weeknight pasta guide']);
});
test('supports AND, OR, NOT and grouping', () => {
  assert.deepEqual(bookmarks.filter(compileSearch('pasta AND #cooking AND #weekend').test).map(x => x.title), ['Pasta for a dinner party']);
  assert.deepEqual(bookmarks.filter(compileSearch('pasta AND (#cooking OR #weekend) NOT #travel').test).map(x => x.title), ['Pasta for a dinner party', 'Weeknight pasta guide']);
});
test('quoted operator is literal text', () => assert.deepEqual(bookmarks.filter(compileSearch('"and"').test).map(x => x.title), ['Pasta for a dinner party', 'And Then There Were None']));
test('reports unclosed grouping', () => assert.throws(() => compileSearch('pasta AND ('), /unclosed parenthesis/i));
test('sorts only supplied active items', () => assert.deepEqual(sortBookmarks(bookmarks.slice(0, 2), 'title').map(x => x.title), ['Pasta for a dinner party', 'Weeknight pasta guide']));
