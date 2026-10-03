import test from 'node:test';
import assert from 'node:assert/strict';
import { exportNetscape, parseNetscape } from '../src/netscape.js';

test('export produces standard format with title, tags, add_date (SCN-023)', () => {
  const html = exportNetscape([
    { url: 'http://a.com', title: 'Site A', description: 'desc', tags: ['x', 'y'], added: 1700000000000 },
  ]);
  assert.match(html, /<!DOCTYPE NETSCAPE-Bookmark-file-1>/);
  assert.match(html, /HREF="http:\/\/a\.com"/);
  assert.match(html, /ADD_DATE="1700000000"/);
  assert.match(html, /TAGS="x,y"/);
  assert.match(html, /Site A/);
  assert.match(html, /<DD>desc/);
});

test('round-trip preserves titles, tags, original dates (SCN-023)', () => {
  const items = [
    { url: 'http://a.com/p', title: 'A page', description: 'about a', tags: ['read', 'later'], added: 1690000000000 },
    { url: 'http://b.com', title: 'B', description: '', tags: [], added: 1695000000000 },
  ];
  const parsed = parseNetscape(exportNetscape(items));
  assert.equal(parsed.length, 2);
  assert.equal(parsed[0].url, 'http://a.com/p');
  assert.equal(parsed[0].title, 'A page');
  assert.deepEqual(parsed[0].tags, ['read', 'later']);
  assert.equal(parsed[0].added, 1690000000000);
  assert.equal(parsed[0].description, 'about a');
});

test('parses a browser-style export', () => {
  const html = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
  <DL><p>
    <DT><A HREF="https://news.example.com" ADD_DATE="1600000000" TAGS="news,daily">Example News</A>
    <DT><A HREF="https://blog.example.com" ADD_DATE="1600000500">Blog</A>
  </DL><p>`;
  const parsed = parseNetscape(html);
  assert.equal(parsed.length, 2);
  assert.deepEqual(parsed[0].tags, ['news', 'daily']);
  assert.equal(parsed[1].title, 'Blog');
});
