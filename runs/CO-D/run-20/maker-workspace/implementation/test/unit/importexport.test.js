import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toNetscapeHtml, parseNetscapeHtml } from '../../src/importexport.js';

test('export produces Netscape HTML with title, tags and add_date (SCN-017)', () => {
  const html = toNetscapeHtml([
    { url: 'https://example.com/a', title: 'Alpha', tags: ['news', 'reading'], createdAt: 1600000000000, updatedAt: 1600000000000, notes: 'a note' },
  ]);
  assert.match(html, /NETSCAPE-Bookmark-file-1/);
  assert.match(html, /HREF="https:\/\/example.com\/a"/);
  assert.match(html, /ADD_DATE="1600000000"/);
  assert.match(html, /TAGS="news,reading"/);
  assert.match(html, />Alpha<\/A>/);
});

test('import parses href, title, tags and add_date; round-trips (SCN-017)', () => {
  const src = `<!DOCTYPE NETSCAPE-Bookmark-file-1><DL><p>
    <DT><A HREF="https://example.com/a" ADD_DATE="1600000000" TAGS="news,reading">Alpha article</A>
    <DT><A HREF="https://example.org/b">Beta no date</A>
  </DL><p>`;
  const recs = parseNetscapeHtml(src);
  assert.equal(recs.length, 2);
  assert.equal(recs[0].url, 'https://example.com/a');
  assert.equal(recs[0].title, 'Alpha article');
  assert.deepEqual(recs[0].tags, ['news', 'reading']);
  assert.equal(recs[0].addDate, 1600000000 * 1000);
  assert.equal(recs[1].addDate, null); // missing date -> caller defaults to today
});

test('import ignores content with no anchors (SCN-019)', () => {
  assert.equal(parseNetscapeHtml('<html><body>no links</body></html>').length, 0);
});
