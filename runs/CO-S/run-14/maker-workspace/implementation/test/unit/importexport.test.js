'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { parseNetscape, buildBookmarksHtml, buildBackupJson } = require('../../src/importexport');

const SAMPLE = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<DL><p>
  <DT><H3>Work</H3>
  <DL><p>
    <DT><A HREF="https://github.com/torvalds/linux" ADD_DATE="1497830400" TAGS="oss">torvalds/linux</A>
    <DT><A HREF="https://developer.mozilla.org" ADD_DATE="1580515200">MDN Web Docs</A>
  </DL><p>
  <DT><H3>Recipes</H3>
  <DL><p>
    <DT><A HREF="https://cooking.example.com/pasta" ADD_DATE="1656633600" TAGS="quick,dinner">Weeknight pasta</A>
  </DL><p>
</DL><p>`;

test('parseNetscape preserves title, folder, ADD_DATE and TAGS (SCN-021)', () => {
  const items = parseNetscape(SAMPLE);
  assert.strictEqual(items.length, 3);
  const linux = items.find(i => i.url.includes('torvalds'));
  assert.strictEqual(linux.title, 'torvalds/linux');
  assert.strictEqual(linux.folder, 'Work');
  assert.strictEqual(linux.added, 1497830400);
  assert.deepStrictEqual(linux.tags, ['oss']);
  const pasta = items.find(i => i.url.includes('pasta'));
  assert.strictEqual(pasta.folder, 'Recipes');
  assert.deepStrictEqual(pasta.tags, ['quick', 'dinner']);
});

test('a file with no bookmarks parses to an empty list', () => {
  assert.deepStrictEqual(parseNetscape('<html><body>nothing here</body></html>'), []);
});

test('buildBookmarksHtml records title, ADD_DATE and TAGS (SCN-022)', () => {
  const html = buildBookmarksHtml([{ url: 'https://x.test/a', title: 'A', createdAt: 1497830400000, tags: ['t1', 't2'] }]);
  assert.match(html, /HREF="https:\/\/x\.test\/a"/);
  assert.match(html, /ADD_DATE="1497830400"/);
  assert.match(html, /TAGS="t1,t2"/);
  assert.match(html, />A<\/A>/);
});

test('buildBackupJson includes app fields', () => {
  const json = JSON.parse(buildBackupJson([{ id: '1', url: 'u', note: 'n', tags: ['x'], readLater: true, archived: false }]));
  assert.strictEqual(json.bookmarks[0].note, 'n');
  assert.strictEqual(json.bookmarks[0].readLater, true);
});

test('round-trip: export then re-import preserves title/date/tags', () => {
  const html = buildBookmarksHtml([{ url: 'https://x.test/a', title: 'Alpha', createdAt: 1497830400000, tags: ['t1'] }]);
  const items = parseNetscape(html);
  assert.strictEqual(items[0].title, 'Alpha');
  assert.strictEqual(items[0].added, 1497830400);
  assert.deepStrictEqual(items[0].tags, ['t1']);
});
