'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { parseBookmarksHtml, buildBookmarksHtml } = require('../src/lib/bookmarksHtml');

const SAMPLE = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<DL><p>
  <DT><H3>News</H3>
  <DL><p>
    <DT><H3>Tech</H3>
    <DL><p>
      <DT><A HREF="https://example.com/a" ADD_DATE="1700000000">Example A</A>
    </DL><p>
    <DT><A HREF="https://example.com/b" ADD_DATE="1700000001" TAGS="reading,focus">Example B</A>
  </DL><p>
</DL><p>`;

test('parse extracts href, title, date, tags and folder tags', () => {
  const { ok, records } = parseBookmarksHtml(SAMPLE, { folderTags: true });
  assert.ok(ok);
  assert.strictEqual(records.length, 2);
  const a = records.find(r => r.url === 'https://example.com/a');
  assert.strictEqual(a.title, 'Example A');
  assert.strictEqual(a.addDate, 1700000000 * 1000);
  assert.ok(a.tags.includes('news'));
  assert.ok(a.tags.includes('tech'));
  const b = records.find(r => r.url === 'https://example.com/b');
  assert.ok(b.tags.includes('reading') && b.tags.includes('focus'));
  assert.ok(b.tags.includes('news')); // still under News folder
});

test('folderTags=false keeps only explicit tags', () => {
  const { records } = parseBookmarksHtml(SAMPLE, { folderTags: false });
  const a = records.find(r => r.url === 'https://example.com/a');
  assert.deepStrictEqual(a.tags, []);
});

test('invalid file is rejected', () => {
  const { ok } = parseBookmarksHtml('just some text, not bookmarks');
  assert.strictEqual(ok, false);
});

test('build then re-parse round-trips extras (note, status, archived)', () => {
  const html = buildBookmarksHtml([
    { url: 'https://x.com/1', title: 'One', created_at: 1700000000000, tags: ['a', 'b'],
      note: 'my **note**', status: 'finished', archived: true }
  ]);
  const { records } = parseBookmarksHtml(html, { folderTags: false });
  assert.strictEqual(records.length, 1);
  const r = records[0];
  assert.strictEqual(r.url, 'https://x.com/1');
  assert.strictEqual(r.title, 'One');
  assert.strictEqual(r.addDate, 1700000000000);
  assert.deepStrictEqual(r.tags, ['a', 'b']);
  assert.strictEqual(r.note, 'my **note**');
  assert.strictEqual(r.status, 'finished');
  assert.strictEqual(r.archived, true);
});

test('export escapes special characters', () => {
  const html = buildBookmarksHtml([{ url: 'https://x.com/?a=1&b=2', title: 'A & B <ok>', tags: [] }]);
  assert.ok(html.includes('https://x.com/?a=1&amp;b=2'));
  assert.ok(html.includes('A &amp; B &lt;ok&gt;'));
});
