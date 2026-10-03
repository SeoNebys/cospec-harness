import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseBookmarkFile } from '../../src/server/services/importExport.js';

const SAMPLE = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks</H1>
<DL><p>
  <DT><A HREF="https://a.example/" ADD_DATE="1600000000" TAGS="work,news">Site A</A>
  <DD>Description A
  <DT><A HREF="https://b.example/">Site B no date no tags</A>
  <DT><A HREF="place:sorted">Browser special (unimportable)</A>
</DL><p>`;

test('parses entries with title, tags, and date-added', () => {
  const entries = parseBookmarkFile(SAMPLE);
  assert.equal(entries.length, 3);
  assert.equal(entries[0].address, 'https://a.example/');
  assert.equal(entries[0].title, 'Site A');
  assert.deepEqual(entries[0].tags, ['work', 'news']);
  assert.equal(entries[0].dateAdded, new Date(1600000000 * 1000).toISOString());
});

test('entry without date/tags yields nulls/empty for fallbacks', () => {
  const entries = parseBookmarkFile(SAMPLE);
  assert.equal(entries[1].dateAdded, null);
  assert.deepEqual(entries[1].tags, []);
});

test('malformed content throws 400', () => {
  assert.throws(() => parseBookmarkFile('just some random text, not a bookmark file'), (e) => e.status === 400);
});
