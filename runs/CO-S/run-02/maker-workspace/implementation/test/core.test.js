'use strict';
const test = require('node:test');
const assert = require('node:assert');
const BM = require('../src/core.js');

test('looksLikeUrl accepts links and rejects junk', function () {
  assert.ok(BM.looksLikeUrl('https://example.com'));
  assert.ok(BM.looksLikeUrl('example.com/path'));
  assert.ok(BM.looksLikeUrl('sub.example.co.uk'));
  assert.ok(!BM.looksLikeUrl('hello world'));
  assert.ok(!BM.looksLikeUrl('just some text'));
  assert.ok(!BM.looksLikeUrl(''));
  assert.ok(!BM.looksLikeUrl('nodots'));
});

test('normalizeUrl treats scheme/www/trailing-slash as the same link', function () {
  const a = BM.normalizeUrl('https://www.Example.com/page/');
  const b = BM.normalizeUrl('example.com/page');
  assert.strictEqual(a, b);
});

test('normalizeTag collapses case and whitespace', function () {
  assert.strictEqual(BM.normalizeTag('  Cooking '), 'cooking');
  assert.strictEqual(BM.normalizeTag('read   later'), 'read later');
});

test('add stores a bookmark and keeps optional name', function () {
  const s = new BM.BookmarkStore();
  const r = s.add({ url: 'example.com', title: 'My Site', tags: ['a'] }, 100);
  assert.ok(r.ok);
  assert.strictEqual(r.bookmark.title, 'My Site');
  assert.strictEqual(r.bookmark.url, 'https://example.com');
  assert.deepStrictEqual(r.bookmark.tags, ['a']);
});

test('displayName falls back to the url when unnamed', function () {
  const s = new BM.BookmarkStore();
  const r = s.add({ url: 'example.com', title: '' }, 100);
  assert.strictEqual(BM.displayName(r.bookmark), 'https://example.com');
});

test('normalizeTags removes blanks and duplicates', function () {
  assert.deepStrictEqual(BM.normalizeTags(['A', 'a', ' ', 'b']), ['a', 'b']);
});

test('suggestTags matches existing tags and offers create for new ones', function () {
  const s = new BM.BookmarkStore();
  s.add({ url: 'a.com', tags: ['cooking', 'recipes'] }, 1);
  const hit = s.suggestTags('coo', []);
  assert.deepStrictEqual(hit.matches, ['cooking']);
  assert.strictEqual(hit.canCreate, true); // 'coo' is not itself an existing tag
  const exact = s.suggestTags('cooking', []);
  assert.strictEqual(exact.canCreate, false); // already exists
  const already = s.suggestTags('recipes', ['recipes']);
  assert.strictEqual(already.matches.indexOf('recipes'), -1); // not re-suggested
});
