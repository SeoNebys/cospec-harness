import { test } from 'node:test';
import assert from 'node:assert/strict';
import { exportNetscape, parseNetscape } from '../../src/services/netscape.js';

test('export then parse round-trips title, tags, date', () => {
  const date = '2026-01-02T03:04:05.000Z';
  const html = exportNetscape([
    { url: 'https://example.com/a', title: 'Article A', tags: ['read', 'js'], dateAdded: date, description: 'Summary A' },
  ]);
  assert.match(html, /NETSCAPE-Bookmark-file/);
  const { bookmarks } = parseNetscape(html);
  assert.equal(bookmarks.length, 1);
  const b = bookmarks[0];
  assert.equal(b.url, 'https://example.com/a');
  assert.equal(b.title, 'Article A');
  assert.deepEqual(b.tags.sort(), ['js', 'read']);
  assert.equal(b.dateAdded, date);
  assert.equal(b.description, 'Summary A');
});

test('missing tags and date default gracefully', () => {
  const html = `<!DOCTYPE NETSCAPE-Bookmark-file-1><DL><p>
    <DT><A HREF="https://example.com/x">No meta</A>
  </DL><p>`;
  const { bookmarks } = parseNetscape(html);
  assert.equal(bookmarks[0].tags.length, 0);
  assert.equal(bookmarks[0].dateAdded, null);
  assert.equal(bookmarks[0].title, 'No meta');
});

test('invalid file rejected', () => {
  assert.throws(() => parseNetscape('just some random text'));
  assert.throws(() => parseNetscape('<html><body>nothing here</body></html>'));
});

test('non-http anchors skipped', () => {
  const html = `<!DOCTYPE NETSCAPE-Bookmark-file-1><DL><p>
    <DT><A HREF="javascript:void(0)">bad</A>
    <DT><A HREF="https://ok.com">good</A>
  </DL><p>`;
  const { bookmarks } = parseNetscape(html);
  assert.equal(bookmarks.length, 1);
  assert.equal(bookmarks[0].url, 'https://ok.com');
});
