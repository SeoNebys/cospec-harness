import test from 'node:test';
import assert from 'node:assert/strict';
import { applyBulk, filterBookmarks, makeBookmark, normalizeUrl, sortBookmarks } from '../lib/domain.js';
import { browserHtml, parseBrowserBookmarks, previewImport } from '../lib/import.js';
import { captureUrl } from '../lib/capture.js';

test('normalizes cosmetic tracking and fragments but preserves meaningful query values', () => {
  assert.equal(normalizeUrl('HTTPS://Example.com/story/?utm_source=news#part'), 'https://example.com/story');
  assert.equal(normalizeUrl('https://example.com/story?page=2'), 'https://example.com/story?page=2');
  assert.notEqual(normalizeUrl('https://example.com/story?page=2'), normalizeUrl('https://example.com/story?page=3'));
});

test('rejects text that is not a complete HTTP address', () => {
  assert.throws(() => normalizeUrl('example dot com'), /complete web address/);
  assert.throws(() => normalizeUrl('javascript:alert(1)'), /complete web address/);
});

test('search covers title, description, and full address without case sensitivity', () => {
  const items = [makeBookmark({ url: 'https://css-tricks.com/grid', title: 'Layout', description: 'Keyboard navigation patterns' })];
  assert.equal(filterBookmarks(items, { text: 'KEYBOARD' }).length, 1);
  assert.equal(filterBookmarks(items, { text: 'css-tricks.com' }).length, 1);
});

test('guided conditions combine AND with any/all label grouping', () => {
  const items = [
    makeBookmark({ url: 'https://a.example/one', title: 'Keyboard navigation', labels: ['Design'] }),
    makeBookmark({ url: 'https://b.example/two', title: 'Keyboard navigation', labels: ['Reference'] }),
    makeBookmark({ url: 'https://css-tricks.com/three', title: 'Keyboard navigation', labels: ['Design'] })
  ];
  assert.equal(filterBookmarks(items, { exact: 'keyboard navigation', labels: ['Design', 'Reference'], labelMode: 'any', excludeSite: 'css-tricks.com' }).length, 2);
  assert.equal(filterBookmarks(items, { labels: ['Design', 'Reference'], labelMode: 'all' }).length, 0);
});

test('ordinary searches exclude put-away bookmarks while put-away view finds them', () => {
  const bookmark = { ...makeBookmark({ url: 'https://example.com', title: 'Hidden' }), putAway: true };
  assert.equal(filterBookmarks([bookmark], { view: 'all', text: 'Hidden' }).length, 0);
  assert.equal(filterBookmarks([bookmark], { view: 'put-away', text: 'Hidden' }).length, 1);
});

test('bulk actions are reversible and affect only selected ids', () => {
  const first = makeBookmark({ url: 'https://a.example', title: 'A' });
  const second = makeBookmark({ url: 'https://b.example', title: 'B' });
  let items = applyBulk([first, second], [first.id], 'unread');
  assert.equal(items[0].readLater, true); assert.equal(items[1].readLater, false);
  items = applyBulk(items, [first.id], 'read'); assert.equal(items[0].readLater, false);
  items = applyBulk(items, [first.id], 'add-label', 'Design'); assert.deepEqual(items[0].labels, ['Design']);
  items = applyBulk(items, [first.id], 'remove-label', 'design'); assert.deepEqual(items[0].labels, []);
});

test('unknown dates are always placed after known dates for both date orders', () => {
  const newer = makeBookmark({ url: 'https://new.example', title: 'New', createdAt: '2025-01-02T00:00:00Z' });
  const older = makeBookmark({ url: 'https://old.example', title: 'Old', createdAt: '2025-01-01T00:00:00Z' });
  const unknown = makeBookmark({ url: 'https://unknown.example', title: 'Unknown', createdAt: null, dateKnown: false });
  assert.deepEqual(sortBookmarks([unknown, older, newer], 'newest').map(item => item.title), ['New', 'Old', 'Unknown']);
  assert.deepEqual(sortBookmarks([unknown, newer, older], 'oldest').map(item => item.title), ['Old', 'New', 'Unknown']);
});

test('browser import keeps folder labels and reports missing dates honestly', () => {
  const html = `<!DOCTYPE NETSCAPE-Bookmark-file-1><DL><p>\n<DT><H3>Design</H3>\n<DL><p>\n<DT><A HREF="https://a.example" ADD_DATE="1700000000">Example A</A>\n<DT><A HREF="https://b.example">Example B</A>\n</DL><p>\n</DL><p>`;
  const parsed = parseBrowserBookmarks(html);
  assert.equal(parsed.length, 2); assert.deepEqual(parsed[0].labels, ['Design']); assert.equal(parsed[1].dateKnown, false);
  const preview = previewImport(parsed, [makeBookmark({ url: 'https://a.example', title: 'Edited A' })]);
  assert.deepEqual({ total: preview.total, duplicates: preview.duplicates, newCount: preview.newCount, dated: preview.dated }, { total: 2, duplicates: 1, newCount: 1, dated: 1 });
});

test('portable export contains addresses and label folders but not captures', () => {
  const bookmark = makeBookmark({ url: 'https://example.com', title: 'Example', labels: ['Reference'], capture: { type: 'pdf', data: 'secret-pdf' } });
  const html = browserHtml([bookmark]);
  assert.match(html, /Reference/); assert.match(html, /https:\/\/example.com/); assert.doesNotMatch(html, /secret-pdf/);
});

test('capture keeps readable page content and immutable save metadata', async () => {
  const response = new Response('<html><head><title>Useful page</title><meta name="description" content="A guide"><meta property="og:image" content="/cover.jpg"></head><body><article><p>Actual useful text.</p></article></body></html>', { headers: { 'content-type': 'text/html' } });
  Object.defineProperty(response, 'url', { value: 'https://example.com/page' });
  const image = new Response(Buffer.from([1, 2, 3]), { headers: { 'content-type': 'image/jpeg' } });
  const result = await captureUrl('https://example.com/page', { fetcher: async url => String(url).endsWith('cover.jpg') ? image : response, allowPrivate: true });
  assert.equal(result.title, 'Useful page'); assert.match(result.capture.text, /Actual useful text/); assert.equal(result.capture.sourceUrl, 'https://example.com/page'); assert.match(result.capture.image, /^data:image\/jpeg;base64,/);
});

test('capture preserves the real PDF bytes and filename', async () => {
  const response = new Response(Buffer.from('%PDF-1.7\nexample'), { headers: { 'content-type': 'application/pdf' } });
  Object.defineProperty(response, 'url', { value: 'https://example.com/paper.pdf' });
  const result = await captureUrl('https://example.com/paper.pdf', { fetcher: async () => response, allowPrivate: true });
  assert.equal(result.capture.type, 'pdf'); assert.equal(result.capture.filename, 'paper.pdf'); assert.equal(Buffer.from(result.capture.data, 'base64').subarray(0, 4).toString(), '%PDF');
});
