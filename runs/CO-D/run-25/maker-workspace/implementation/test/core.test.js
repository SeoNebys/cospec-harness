import test from 'node:test';
import assert from 'node:assert/strict';
import { compileSearch, extractMetadata, markdownToHtml, normalizeLabel, normalizeUrl, sortBookmarks } from '../lib/core.js';

const bookmarks = [
  { title:'CSS grid layout', description:'Rows and columns', note:'Compare grid and flexbox', url:'https://developer.mozilla.org/grid', labels:['CSS','Reference'], createdAt:'2026-01-03T00:00:00Z' },
  { title:'Designing empty states', description:'Helpful and easy', note:'', url:'https://smashing.example/empty', labels:['Reference'], createdAt:'2026-01-02T00:00:00Z' },
  { title:'The modern JavaScript tutorial', description:'From fundamentals to advanced topics', note:'', url:'https://javascript.info', labels:['JavaScript'], createdAt:'2026-01-01T00:00:00Z' }
];

test('normalizes tracking and fragments for duplicate comparison', () => {
  assert.equal(normalizeUrl('https://Example.com/page/?utm_source=x&b=2&a=1#part'), 'https://example.com/page?a=1&b=2');
});

test('rejects unsupported bookmark schemes', () => assert.throws(() => normalizeUrl('file:///notes.txt'), /http/));

test('renders supported note formatting and preserves stray marks', () => {
  const output = markdownToHtml('**Review**\n- One\n- Two\n2 * 3\n**unfinished');
  assert.match(output, /<strong>Review<\/strong>/); assert.match(output, /<ul><li>One<\/li><li>Two<\/li><\/ul>/);
  assert.match(output, /2 \* 3/); assert.match(output, /\*\*unfinished/);
});

test('reuses established label spelling without duplicates', () => assert.equal(normalizeLabel(' reference ', ['Reference']), 'Reference'));

test('searches text, notes, addresses and exact labels without case sensitivity', () => {
  assert.deepEqual(bookmarks.filter(compileSearch('FLEXBOX').test).map(x=>x.title), ['CSS grid layout']);
  assert.deepEqual(bookmarks.filter(compileSearch('MOZILLA').test).map(x=>x.title), ['CSS grid layout']);
  assert.equal(bookmarks.filter(compileSearch('#reference').test).length, 2);
});

test('supports and, or, not and grouped expressions', () => {
  assert.equal(bookmarks.filter(compileSearch('flexbox and #css').test).length, 1);
  assert.equal(bookmarks.filter(compileSearch('grid or JavaScript').test).length, 2);
  assert.deepEqual(bookmarks.filter(compileSearch('not #reference').test).map(x=>x.title), ['The modern JavaScript tutorial']);
  assert.equal(bookmarks.filter(compileSearch('(grid or empty) and #reference').test).length, 2);
});

test('quoted phrases are ordered and quoted command words are whole words', () => {
  assert.equal(bookmarks.filter(compileSearch('"modern JavaScript"').test).length, 1);
  assert.equal(bookmarks.filter(compileSearch('"and"').test).length, 2);
});

test('reports incomplete live queries', () => {
  assert.equal(compileSearch('grid and').incomplete, true); assert.equal(compileSearch('"grid').incomplete, true); assert.equal(compileSearch('grid (#css').incomplete, true);
});

test('sorts in each approved direction', () => {
  assert.equal(sortBookmarks(bookmarks,'recent')[0].title,'CSS grid layout');
  assert.equal(sortBookmarks(bookmarks,'oldest')[0].title,'The modern JavaScript tutorial');
  assert.equal(sortBookmarks(bookmarks,'az')[0].title,'CSS grid layout');
  assert.equal(sortBookmarks(bookmarks,'za')[0].title,'The modern JavaScript tutorial');
});

test('extracts page metadata and resolves relative assets', () => {
  const details=extractMetadata('<title>Example &amp; Guide</title><meta name="description" content="A useful page"><meta property="og:image" content="/cover.png"><link rel="icon" href="icon.svg">','https://example.com/post');
  assert.equal(details.title,'Example & Guide'); assert.equal(details.description,'A useful page'); assert.equal(details.image,'https://example.com/cover.png'); assert.equal(details.icon,'https://example.com/icon.svg');
});
