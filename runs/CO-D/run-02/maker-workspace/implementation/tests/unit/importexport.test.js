'use strict';
// Unit tests for import/export (SCN-019).
const { test } = require('node:test');
const assert = require('node:assert');
const { parseNetscape, parseImport, toNetscape, toJson } = require('../../src/importexport.js');

const NETSCAPE = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<DL><p>
  <DT><A HREF="https://a.com/start" ADD_DATE="1704067200" TAGS="reference,howto">Getting started</A>
  <DT><H3>Reading</H3>
  <DL><p>
    <DT><A HREF="https://b.com/deep" ADD_DATE="1711929600" TAGS="longform">The deep dive</A>
    <DT><H3>Cooking</H3>
    <DL><p>
      <DT><A HREF="https://c.com/carbonara" ADD_DATE="1719792000" TAGS="quick">Carbonara</A>
    </DL><p>
  </DL><p>
  <DT><A HREF="https://d.com/paper.pdf" ADD_DATE="1722470400">Whitepaper</A>
</DL><p>`;

test('parses all bookmarks including nested folders', () => {
  const r = parseNetscape(NETSCAPE);
  assert.equal(r.length, 4);
});

test('folders become tags, added to existing tags', () => {
  const r = parseNetscape(NETSCAPE);
  const carbonara = r.find(x => x.title === 'Carbonara');
  assert.deepEqual(carbonara.tags.sort(), ['cooking', 'quick', 'reading']);
});

test('original saved dates preserved', () => {
  const r = parseNetscape(NETSCAPE);
  const start = r.find(x => x.title === 'Getting started');
  assert.equal(start.created, 1704067200 * 1000);
});

test('JSON import round-trips fields', () => {
  const json = toJson([{ url: 'https://x.com/a', title: 'A', description: 'd', note: 'n', tags: ['t'], created: 123, updated: 456, toRead: true, archived: false }]);
  const back = parseImport(json);
  assert.equal(back.length, 1);
  assert.equal(back[0].title, 'A');
  assert.equal(back[0].note, 'n');
  assert.equal(back[0].created, 123);
  assert.equal(back[0].toRead, true);
});

test('HTML export preserves title, tags and saved date', () => {
  const html = toNetscape([{ url: 'https://x.com/a', title: 'My & Title', tags: ['one', 'two'], created: 1704067200000 }]);
  assert.match(html, /ADD_DATE="1704067200"/);
  assert.match(html, /TAGS="one,two"/);
  assert.match(html, /My &amp; Title/);
});
