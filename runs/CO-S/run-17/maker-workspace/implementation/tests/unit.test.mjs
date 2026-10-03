import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canonicalAddress,
  canonicalizeTags,
  decodeEntities,
  displayDomain,
  extractPageDetails,
  isPrivateHost,
  matchesQuery,
  normalizeNewTag,
  noteOnlyMatch,
  parseWebAddress,
  tagSummary
} from '../lib/core.mjs';

test('accepts complete HTTP(S) addresses and rejects incomplete or unsafe schemes', () => {
  assert.equal(parseWebAddress('https://example.com/article').hostname, 'example.com');
  assert.equal(parseWebAddress('http://example.com').protocol, 'http:');
  assert.equal(parseWebAddress('example.com'), null);
  assert.equal(parseWebAddress('javascript:alert(1)'), null);
});

test('canonicalizes addresses for duplicate detection', () => {
  assert.equal(canonicalAddress('HTTPS://Example.COM:443/article/#part'), 'https://example.com/article');
  assert.equal(canonicalAddress('https://example.com/article/'), 'https://example.com/article');
});

test('derives a human-readable website name', () => {
  assert.equal(displayDomain('https://www.seriouseats.com/food'), 'seriouseats.com');
});

test('normalizes and reuses tags without case-insensitive duplicates', () => {
  assert.equal(normalizeNewTag('  travel  tips '), 'Travel tips');
  assert.deepEqual(canonicalizeTags(['recipes', 'RECIPES', 'travel'], ['Recipes']), ['Recipes', 'Travel']);
});

test('summarizes tag counts alphabetically', () => {
  assert.deepEqual(tagSummary([{ tags: ['Recipes', 'Research'] }, { tags: ['Recipes'] }]), [
    { name: 'Recipes', count: 2 },
    { name: 'Research', count: 1 }
  ]);
});

test('searches title, description, and note and detects note-only matches', () => {
  const bookmark = { title: 'The Food Lab', description: 'Cooking science', note: 'Try fermentation next' };
  assert.equal(matchesQuery(bookmark, 'food'), true);
  assert.equal(matchesQuery(bookmark, 'science'), true);
  assert.equal(matchesQuery(bookmark, 'fermentation'), true);
  assert.equal(matchesQuery(bookmark, 'astronomy'), false);
  assert.equal(noteOnlyMatch(bookmark, 'fermentation'), true);
  assert.equal(noteOnlyMatch(bookmark, 'food'), false);
});

test('extracts recognizable metadata and decodes entities', () => {
  const html = '<html><head><title>Fallback</title><meta name="description" content="A &amp; B"><meta property="og:title" content="The Food Lab"></head></html>';
  assert.deepEqual(extractPageDetails(html, 'https://www.seriouseats.com/a'), { title: 'The Food Lab', description: 'A & B', domain: 'seriouseats.com' });
  assert.equal(decodeEntities('Tom &amp; Jerry &#33;'), 'Tom & Jerry !');
});

test('uses a readable fallback description when a page has none', () => {
  const details = extractPageDetails('<title>Useful page</title>', 'https://example.com/page');
  assert.equal(details.description, 'A page saved from example.com.');
});

test('identifies local and private hosts', () => {
  assert.equal(isPrivateHost('localhost'), true);
  assert.equal(isPrivateHost('127.0.0.1'), true);
  assert.equal(isPrivateHost('192.168.1.4'), true);
  assert.equal(isPrivateHost('8.8.8.8'), false);
  assert.equal(isPrivateHost('example.com'), false);
});
