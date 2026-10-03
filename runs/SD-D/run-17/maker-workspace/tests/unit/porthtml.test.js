import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseBookmarksHtml, generateBookmarksHtml } from '../../src/services/porthtml.js';

test('round-trip preserves titles, tags, and dates', () => {
  const bookmarks = [
    { url: 'https://example.com/', title: 'Example', tags: ['news', 'tech'],
      created_at: '2020-01-01T00:00:00.000Z', updated_at: '2021-06-15T12:00:00.000Z' },
    { url: 'https://rust-lang.org/', title: 'Rust', tags: [],
      created_at: '2022-03-03T00:00:00.000Z', updated_at: '2022-03-03T00:00:00.000Z' },
  ];
  const html = generateBookmarksHtml(bookmarks);
  const parsed = parseBookmarksHtml(html);

  assert.equal(parsed.length, 2);
  const ex = parsed.find((b) => b.url === 'https://example.com/');
  assert.equal(ex.title, 'Example');
  assert.deepEqual(ex.tags, ['news', 'tech']);
  assert.equal(ex.created_at, '2020-01-01T00:00:00.000Z');
  assert.equal(ex.updated_at, '2021-06-15T12:00:00.000Z');
});

test('parsing a non-bookmark file throws', () => {
  assert.throws(() => parseBookmarksHtml('<html><body>hello</body></html>'));
  assert.throws(() => parseBookmarksHtml('not html at all'));
});

test('escapes special characters in titles and urls', () => {
  const html = generateBookmarksHtml([
    { url: 'https://e.com/?a=1&b=2', title: 'A & B <tag>',
      created_at: '2020-01-01T00:00:00.000Z', updated_at: '2020-01-01T00:00:00.000Z', tags: [] },
  ]);
  const parsed = parseBookmarksHtml(html);
  assert.equal(parsed[0].url, 'https://e.com/?a=1&b=2');
  assert.equal(parsed[0].title, 'A & B <tag>');
});
