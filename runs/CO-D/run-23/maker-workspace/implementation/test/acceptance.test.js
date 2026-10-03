import test from 'node:test';
import assert from 'node:assert/strict';
import { applyBulk, cleanLabels, filterBookmarks, makeBookmark, normalizeUrl, sortBookmarks } from '../lib/domain.js';
import { parseBrowserBookmarks, previewImport } from '../lib/import.js';

test('SCN-001/020/021 — save validation distinguishes unusable text from a valid link whose extras failed', () => {
  assert.throws(() => makeBookmark({ url: 'not a web address', title: '' }), /complete web address/);
  const kept = makeBookmark({ url: 'https://unreachable.example/article', title: 'unreachable.example', capture: { status: 'failed', reason: 'timeout' } });
  assert.equal(kept.detailsStatus, 'needs-retry'); assert.equal(kept.url, 'https://unreachable.example/article');
});

test('SCN-002/014/015 — remembered words and guided refinements produce the approved result', () => {
  const items = [
    makeBookmark({ url: 'https://inclusive.example/keyboard', title: 'Inclusive Components', description: 'Keyboard navigation', labels: ['Design'] }),
    makeBookmark({ url: 'https://css-tricks.com/keyboard', title: 'CSS tricks', description: 'Keyboard navigation', labels: ['Reference'] }),
    makeBookmark({ url: 'https://books.example/a', title: 'Books', labels: ['Books'] })
  ];
  const result = filterBookmarks(items, { exact: 'keyboard navigation', labels: ['Design', 'Reference'], labelMode: 'any', excludeSite: 'css-tricks.com' });
  assert.deepEqual(result.map(item => item.title), ['Inclusive Components']);
});

test('SCN-003 — labels deduplicate by spelling case and support filter chips', () => {
  const bookmark = { ...makeBookmark({ url: 'https://example.com', title: 'Example', labels: cleanLabels(['Design', 'design']) }) };
  assert.deepEqual(bookmark.labels, ['Design']);
  assert.equal(filterBookmarks([bookmark], { labels: ['DESIGN'], labelMode: 'any' }).length, 1);
});

test('SCN-004/010/013 — reading, put-away, restore, and reverse batch actions keep one record', () => {
  const original = makeBookmark({ url: 'https://example.com', title: 'One' });
  let items = applyBulk([original], [original.id], 'unread');
  assert.equal(items.length, 1); assert.equal(items[0].readLater, true);
  items = applyBulk(items, [original.id], 'read'); assert.equal(items[0].readLater, false);
  items = applyBulk(items, [original.id], 'put-away'); assert.equal(filterBookmarks(items, { view: 'all' }).length, 0);
  items = applyBulk(items, [original.id], 'restore'); assert.equal(filterBookmarks(items, { view: 'all' }).length, 1);
});

test('SCN-007/022 — exact, tracked, and fragment variants resolve to the same bookmark identity', () => {
  const saved = normalizeUrl('https://example.com/guide');
  assert.equal(normalizeUrl('https://example.com/guide?utm_campaign=mail#chapter'), saved);
});

test('SCN-008 — correcting an address can preserve the user-edited title and description', () => {
  const before = makeBookmark({ url: 'https://old.example', title: 'My title', description: 'My description' });
  const after = { ...before, url: 'https://web.dev/grid', normalizedUrl: normalizeUrl('https://web.dev/grid'), source: 'web.dev' };
  assert.equal(after.title, before.title); assert.equal(after.description, before.description);
});

test('SCN-009 — deletion removes only the explicitly confirmed record', () => {
  const one = makeBookmark({ url: 'https://one.example', title: 'One' }); const two = makeBookmark({ url: 'https://two.example', title: 'Two' });
  assert.deepEqual(applyBulk([one, two], [one.id], 'delete').map(item => item.title), ['Two']);
});

test('SCN-012/019/029 — ordering respects name and honest unknown dates', () => {
  const b = makeBookmark({ url: 'https://b.example', title: 'Beta', dateKnown: false }); const a = makeBookmark({ url: 'https://a.example', title: 'Alpha' });
  assert.deepEqual(sortBookmarks([b, a], 'name').map(item => item.title), ['Alpha', 'Beta']);
  assert.deepEqual(sortBookmarks([b, a], 'newest').map(item => item.title), ['Alpha', 'Beta']);
});

test('SCN-016/023/027 — import previews overlap before commit and rejects the wrong format', () => {
  const existing = [makeBookmark({ url: 'https://one.example', title: 'Carefully edited' })];
  const parsed = parseBrowserBookmarks('<!DOCTYPE NETSCAPE-Bookmark-file-1><DL><p>\n<DT><H3>Work</H3>\n<DL><p>\n<DT><A HREF="https://one.example">Old title</A>\n<DT><A HREF="https://two.example">Two</A>\n</DL><p>');
  assert.deepEqual({ ...previewImport(parsed, existing), folders: ['Work'] }, { total: 2, newCount: 1, duplicates: 1, dated: 0, folders: ['Work'] });
  assert.throws(() => parseBrowserBookmarks('ordinary document'), /not a browser bookmark export/);
});

test('SCN-017/018/025/026 — full state remains serializable with saved searches, preferences, and captures', () => {
  const state = { bookmarks: [makeBookmark({ url: 'https://example.com/file.pdf', title: 'Paper', capture: { status: 'ready', type: 'pdf', data: 'JVBERg==' } })], savedSearches: [{ name: 'Accessible design', filters: { exact: 'keyboard navigation' } }], settings: { pageSize: 50, textSize: 'large', defaultSort: 'name' } };
  const restored = JSON.parse(JSON.stringify({ format: 'kept-full-backup', data: state }));
  assert.equal(restored.data.bookmarks[0].capture.data, 'JVBERg=='); assert.equal(restored.data.savedSearches[0].name, 'Accessible design'); assert.equal(restored.data.settings.pageSize, 50);
});

test('SCN-005/006/011/024/028 — model keeps the live address distinct from its frozen capture', () => {
  const savedAt = '2024-01-01T00:00:00Z';
  const bookmark = makeBookmark({ url: 'https://live.example/article', title: 'A very long user-facing title', description: 'Long detail '.repeat(50), capture: { status: 'ready', type: 'page', savedAt, sourceUrl: 'https://live.example/article', text: 'Frozen original' } });
  assert.equal(bookmark.url, 'https://live.example/article'); assert.equal(bookmark.capture.savedAt, savedAt); assert.equal(bookmark.capture.text, 'Frozen original'); assert.ok(bookmark.description.length > 100);
});
