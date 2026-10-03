import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseNetscape, generateNetscape } from '../../src/services/porting.js';

const SAMPLE = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks</H1>
<DL><p>
  <DT><A HREF="https://a.com/one">One</A>
  <DT><H3>Tech</H3>
  <DL><p>
    <DT><A HREF="https://b.com/two">Two</A>
    <DT><A HREF="https://c.com/three">Three</A>
  </DL><p>
</DL><p>`;

test('parseNetscape reads bookmarks and maps folders to tags', () => {
  const entries = parseNetscape(SAMPLE);
  const byUrl = Object.fromEntries(entries.map((e) => [e.address, e]));
  assert.equal(entries.length, 3);
  assert.deepEqual(byUrl['https://a.com/one'].tags, []);
  assert.deepEqual(byUrl['https://b.com/two'].tags, ['Tech']);
  assert.equal(byUrl['https://c.com/three'].title, 'Three');
});

test('parseNetscape reads the TAGS attribute', () => {
  const html = `<DL><p><DT><A HREF="https://x.com" TAGS="reading,tech">X</A></DL><p>`;
  const [e] = parseNetscape(html);
  assert.deepEqual(e.tags.sort(), ['reading', 'tech']);
});

test('generate -> parse round-trip preserves address, title, and tags', () => {
  const bookmarks = [
    { address: 'https://a.com/one', title: 'One', tags: ['reading'], createdAt: new Date().toISOString() },
    { address: 'https://b.com/two', title: 'Two & Co', tags: [], createdAt: new Date().toISOString() },
  ];
  const html = generateNetscape(bookmarks);
  const parsed = parseNetscape(html);
  assert.equal(parsed.length, 2);
  const one = parsed.find((e) => e.address === 'https://a.com/one');
  assert.deepEqual(one.tags, ['reading']);
  const two = parsed.find((e) => e.address === 'https://b.com/two');
  assert.equal(two.title, 'Two & Co');
});
