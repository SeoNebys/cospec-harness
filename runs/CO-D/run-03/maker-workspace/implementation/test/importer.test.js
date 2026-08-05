'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { parseNetscape, foldersToLabels, parseBookmarks, addDateToIso } = require('../server/importer');

const sample = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<DL><p>
  <DT><H3>Cooking</H3>
  <DL><p>
    <DT><A HREF="https://k.example/bread" ADD_DATE="1700000000">No-Knead Bread</A>
    <DT><H3>Baking</H3>
    <DL><p>
      <DT><A HREF="https://k.example/sour" ADD_DATE="1600000000">Sourdough</A>
    </DL><p>
  </DL><p>
  <DT><A HREF="https://b.example/a" ADD_DATE="1735000000">The Article</A>
</DL><p>`;

// SCN-020: folders become label paths; dates preserved.
test('parseNetscape captures folders and dates', () => {
  const items = parseNetscape(sample);
  const bread = items.find((i) => i.url === 'https://k.example/bread');
  assert.equal(bread.folder, 'Cooking');
  assert.ok(bread.date && bread.date.startsWith('20'));
  const sour = items.find((i) => i.url === 'https://k.example/sour');
  assert.equal(sour.folder, 'Cooking/Baking'); // nested
  const art = items.find((i) => i.url === 'https://b.example/a');
  assert.equal(art.folder, null); // top level, no folder
});

test('foldersToLabels lowercases and splits nested paths', () => {
  assert.deepEqual(foldersToLabels('Cooking/Baking'), ['cooking', 'baking']);
  assert.deepEqual(foldersToLabels(null), []);
});

test('addDateToIso handles seconds', () => {
  assert.ok(addDateToIso('1700000000').startsWith('2023'));
  assert.equal(addDateToIso(''), null);
});

// SCN-020: our own export round-trips.
test('parseBookmarks detects own JSON export', () => {
  const own = JSON.stringify({ app: 'bookmarks-app', bookmarks: [{ url: 'https://x.example', title: 'X', labels: ['a'], savedAt: '2021-01-01T00:00:00Z', copyText: 'hi' }] });
  const parsed = parseBookmarks(own);
  assert.equal(parsed.kind, 'own');
  assert.equal(parsed.items[0].url, 'https://x.example');
  assert.equal(parsed.items[0]._full.copyText, 'hi');
});
