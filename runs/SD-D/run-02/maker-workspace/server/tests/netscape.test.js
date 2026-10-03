import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseNetscape, generateNetscape, InvalidBookmarkFileError } from '../src/services/netscape.js';

const SAMPLE = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks</H1>
<DL><p>
  <DT><A HREF="https://example.com/article" ADD_DATE="1758018000" TAGS="reading,js">Example Article</A>
  <DT><A HREF="https://example.org/" ADD_DATE="1600000000">Plain</A>
</DL><p>`;

test('parses href, title, tags, and add_date', () => {
  const entries = parseNetscape(SAMPLE);
  assert.equal(entries.length, 2);
  assert.equal(entries[0].url, 'https://example.com/article');
  assert.equal(entries[0].title, 'Example Article');
  assert.deepEqual(entries[0].tags, ['reading', 'js']);
  assert.equal(entries[0].dateAdded, new Date(1758018000 * 1000).toISOString());
  assert.deepEqual(entries[1].tags, []);
});

test('rejects a non-bookmark file whole', () => {
  assert.throws(() => parseNetscape('<html><body>hello</body></html>'), InvalidBookmarkFileError);
  assert.throws(() => parseNetscape('just some text'), InvalidBookmarkFileError);
});

test('export -> re-import round trip preserves fields', () => {
  const rows = [
    { url: 'https://example.com/a', title: 'A & B', date_added: new Date(1758018000 * 1000).toISOString(), tags: ['x', 'y'] },
  ];
  const file = generateNetscape(rows);
  const back = parseNetscape(file);
  assert.equal(back.length, 1);
  assert.equal(back[0].url, 'https://example.com/a');
  assert.equal(back[0].title, 'A & B');
  assert.deepEqual(back[0].tags, ['x', 'y']);
  assert.equal(back[0].dateAdded, rows[0].date_added);
});
