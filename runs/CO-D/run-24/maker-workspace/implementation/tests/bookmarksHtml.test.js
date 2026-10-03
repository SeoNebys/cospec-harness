'use strict';
// Unit tests for bookmarks HTML import/export (SCN-015).
const test = require('node:test');
const assert = require('node:assert');
const { parseBookmarksHtml, generateBookmarksHtml } = require('../src/bookmarksHtml');

const SAMPLE = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<TITLE>Bookmarks</TITLE><H1>Bookmarks</H1>
<DL><p>
  <DT><H3>Bookmarks bar</H3>
  <DL><p>
    <DT><A HREF="https://example.org/one" ADD_DATE="1600000000">Example One</A>
    <DT><H3>Recipes</H3>
    <DL><p>
      <DT><A HREF="https://cooking.example/pasta" ADD_DATE="1610000000">Pasta</A>
    </DL><p>
  </DL><p>
  <DT><A HREF="https://tagged.example/x" ADD_DATE="1620000000" TAGS="work,reading">Tagged</A>
</DL><p>`;

test('parses titles, dates, folder-tags and TAGS attribute', () => {
  const items = parseBookmarksHtml(SAMPLE);
  const byUrl = Object.fromEntries(items.map((i) => [i.url, i]));
  assert.equal(items.length, 3);
  // Recipes folder becomes a tag; generic "Bookmarks bar" is skipped.
  assert.deepEqual(byUrl['https://cooking.example/pasta'].tags, ['Recipes']);
  assert.equal(byUrl['https://example.org/one'].tags.length, 0);
  // explicit TAGS preserved
  assert.deepEqual(byUrl['https://tagged.example/x'].tags, ['work', 'reading']);
  // original saved date preserved (ADD_DATE seconds -> ms)
  assert.equal(byUrl['https://example.org/one'].createdAt, 1600000000 * 1000);
});

test('export round-trips through import', () => {
  const items = parseBookmarksHtml(SAMPLE);
  const html = generateBookmarksHtml(items);
  assert.ok(html.includes('NETSCAPE-Bookmark-file-1'));
  assert.ok(html.includes('TAGS="work,reading"'));
  const again = parseBookmarksHtml(html);
  assert.equal(again.length, 3);
  const byUrl = Object.fromEntries(again.map((i) => [i.url, i]));
  assert.equal(byUrl['https://example.org/one'].createdAt, 1600000000 * 1000);
});
