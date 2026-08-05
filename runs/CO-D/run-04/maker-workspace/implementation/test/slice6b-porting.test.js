import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseBookmarksHtml, importDate, buildNetscapeHtml, buildBackup } from '../extension/src/porting.js';

const BM = `<!DOCTYPE NETSCAPE-Bookmark-file-1><TITLE>Bookmarks</TITLE><H1>Bookmarks</H1>
<DL><p>
  <DT><H3>Cooking</H3><DL><p>
    <DT><A HREF="https://seriouseats.com/tempering" ADD_DATE="1583020800">How to Temper Chocolate</A>
    <DT><A HREF="https://cooking.example.com/ramen">Ramen (no date)</A>
  </DL><p>
  <DT><A HREF="https://12factor.net" ADD_DATE="1490000000">The Twelve-Factor App</A>
  <DT><A HREF="javascript:void(0)">not a real link</A>
</DL><p>`;

test('SCN-015: parses bookmarks with folder + original date, skips non-http', () => {
  const items = parseBookmarksHtml(BM);
  assert.equal(items.length, 3); // javascript: link ignored
  const temper = items.find((i) => i.url.includes('tempering'));
  assert.equal(temper.title, 'How to Temper Chocolate');
  assert.equal(temper.folder, 'Cooking');
  assert.equal(temper.addDate, 1583020800 * 1000); // seconds -> ms
  const twelve = items.find((i) => i.url.includes('12factor'));
  assert.equal(twelve.folder, ''); // top-level, no folder
});

test('SCN-015: original date preserved; today only as fallback', () => {
  const now = 9999;
  assert.equal(importDate(1583020800000, now), 1583020800000); // keeps real date
  assert.equal(importDate(0, now), now);                        // fallback to today
});

test('SCN-015: export produces a valid Netscape file with dates', () => {
  const html = buildNetscapeHtml([{ url: 'https://x.com/a', title: 'A & B', savedAt: 1583020800000 }]);
  assert.ok(html.includes('<!DOCTYPE NETSCAPE-Bookmark-file-1>'));
  assert.ok(html.includes('HREF="https://x.com/a"'));
  assert.ok(html.includes('ADD_DATE="1583020800"')); // ms -> seconds
  assert.ok(html.includes('A &amp; B'));             // escaped
});

test('round-trip: export then re-import yields the same links & dates', () => {
  const orig = [{ url: 'https://x.com/a', title: 'Alpha', savedAt: 1583020800000 }, { url: 'https://y.com/b', title: 'Beta', savedAt: 1490000000000 }];
  const reimported = parseBookmarksHtml(buildNetscapeHtml(orig));
  assert.deepEqual(reimported.map((r) => r.url), orig.map((o) => o.url));
  assert.equal(reimported[0].addDate, orig[0].savedAt); // date survives the round trip
});

test('SCN-015: full backup is valid JSON carrying links, searches, readable copies', () => {
  const json = buildBackup([{ id: 1, url: 'https://x', title: 'X' }], [{ id: 1, name: 'v' }], [{ linkId: 1, kind: 'reader', html: '<p>hi</p>' }]);
  const o = JSON.parse(json);
  assert.equal(o.app, 'my-links');
  assert.equal(o.links.length, 1);
  assert.equal(o.searches.length, 1);
  assert.equal(o.copies[0].html, '<p>hi</p>');
});
