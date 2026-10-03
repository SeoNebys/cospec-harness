const test = require('node:test');
const assert = require('node:assert');
const { exportHtml, parseHtml } = require('../../lib/bookmarks-html');

// SCN-019
test('export produces Netscape format with title, tags, dates', () => {
  const html = exportHtml([{ url: 'https://a.com/x', title: 'A & B', tags: ['t1', 't2'], addedAt: 1000000000000, updatedAt: 1000000600000, description: 'desc' }]);
  assert.match(html, /<!DOCTYPE NETSCAPE-Bookmark-file-1>/);
  assert.match(html, /HREF="https:\/\/a\.com\/x"/);
  assert.match(html, /ADD_DATE="1000000000"/);
  assert.match(html, /TAGS="t1,t2"/);
  assert.match(html, /A &amp; B/);
});

test('round-trip export then parse retains fields', () => {
  const src = [{ url: 'https://a.com/x', title: 'Title X', tags: ['work', 'read'], addedAt: 1700000000000, updatedAt: 1700000000000 }];
  const parsed = parseHtml(exportHtml(src));
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].url, 'https://a.com/x');
  assert.equal(parsed[0].title, 'Title X');
  assert.deepEqual(parsed[0].tags, ['work', 'read']);
  assert.equal(parsed[0].addedAt, 1700000000000);
});

test('parse of empty/non-bookmark HTML yields nothing (SCN-019 edge)', () => {
  assert.deepEqual(parseHtml('<html><body><p>no links</p></body></html>'), []);
  assert.deepEqual(parseHtml(''), []);
});

test('parses a real browser export snippet', () => {
  const html = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
  <DL><p>
    <DT><A HREF="https://example.org/" ADD_DATE="1600000000" TAGS="news,daily">Example</A>
  </DL><p>`;
  const p = parseHtml(html);
  assert.equal(p.length, 1);
  assert.equal(p[0].url, 'https://example.org/');
  assert.deepEqual(p[0].tags, ['news', 'daily']);
});
