import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse, serialize } from '../../server/services/netscape.js';

const SAMPLE = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks</H1>
<DL><p>
    <DT><A HREF="https://example.com/a" ADD_DATE="1700000000" TAGS="news,tech">Example A</A>
    <DT><A HREF="https://example.com/b" ADD_DATE="1700000100">Example B</A>
    <DT><A HREF="ftp://skip.me/x" ADD_DATE="1700000200">Skip me</A>
</DL><p>`;

test('parses entries with title, tags, and saved date', () => {
  const { entries, skipped } = parse(SAMPLE);
  assert.equal(entries.length, 2);
  assert.equal(skipped, 1); // ftp entry skipped
  assert.deepEqual(entries[0], {
    url: 'https://example.com/a',
    title: 'Example A',
    tags: ['news', 'tech'],
    savedDate: 1700000000 * 1000,
  });
  assert.deepEqual(entries[1].tags, []);
});

test('round-trip retains 100% of titles, tags, and saved dates', () => {
  const original = [
    { url: 'https://a.com/', title: 'Alpha', tags: ['x', 'y'], savedDate: 1700000000000 },
    { url: 'https://b.com/p', title: 'Beta & Co', tags: [], savedDate: 1699999999000 },
  ];
  const html = serialize(original);
  const { entries } = parse(html);
  assert.equal(entries.length, 2);
  for (let i = 0; i < original.length; i++) {
    assert.equal(entries[i].url, original[i].url);
    assert.equal(entries[i].title, original[i].title);
    assert.deepEqual(entries[i].tags, original[i].tags);
    // ADD_DATE is second-resolution; compare at that granularity
    assert.equal(Math.floor(entries[i].savedDate / 1000), Math.floor(original[i].savedDate / 1000));
  }
});

test('malformed/partial input skips bad entries, keeps valid ones', () => {
  const { entries } = parse('<DL><p><DT><A>no href</A><DT><A HREF="https://ok.com/">OK</A></DL>');
  assert.equal(entries.length, 1);
  assert.equal(entries[0].url, 'https://ok.com/');
});
