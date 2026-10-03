import test from 'node:test';
import assert from 'node:assert/strict';
import { matchesSearch, normalizeTag, normalizeUrl, publicBookmark } from '../lib/bookmarks.js';

test('normalizes bookmark URLs for duplicate comparison', () => {
  assert.equal(normalizeUrl(' HTTPS://Example.COM/article/#section '), 'https://example.com/article');
  assert.equal(normalizeUrl('https://example.com/article?edition=2#top'), 'https://example.com/article?edition=2');
});

test('rejects malformed and unsupported addresses', () => {
  assert.throws(() => normalizeUrl('remember this'), /web address/);
  assert.throws(() => normalizeUrl('file:///tmp/page'), /http and https/);
});

test('normalizes tags and removes near duplicates', () => {
  const bookmark = publicBookmark({ url: 'https://example.com', title: 'Example', tags: ['reading', ' Reading ', 'WORK'] });
  assert.deepEqual(bookmark.tags, ['reading', 'work']);
  assert.equal(normalizeTag('  Project   Ideas '), 'project ideas');
});

test('searches title, description, and notes without case sensitivity', () => {
  const item = publicBookmark({ url: 'https://example.com', title: 'Reading Habit', description: 'A comforting guide', notes: 'Share at the conference' });
  assert.equal(matchesSearch(item, 'READING'), true);
  assert.equal(matchesSearch(item, 'COMFORTING'), true);
  assert.equal(matchesSearch(item, 'CONFERENCE'), true);
  assert.equal(matchesSearch(item, 'reading conference'), true);
  assert.equal(matchesSearch(item, 'moonbase'), false);
});
