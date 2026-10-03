'use strict';

const test = require('node:test');
const assert = require('node:assert');
const logic = require('../src/logic');

test('normaliseUrl adds scheme and rejects non-addresses (SCN-005)', () => {
  assert.strictEqual(logic.normaliseUrl('example.com/page'), 'https://example.com/page');
  assert.strictEqual(logic.normaliseUrl('  https://a.com/x  '), 'https://a.com/x');
  assert.strictEqual(logic.normaliseUrl('not a link'), null);
  assert.strictEqual(logic.normaliseUrl(''), null);
  assert.strictEqual(logic.normaliseUrl('justtext'), null);
});

test('normaliseUrl strips the fragment so duplicates match (SCN-006)', () => {
  assert.strictEqual(logic.normaliseUrl('https://a.com/p#section'), 'https://a.com/p');
});

test('normaliseTag lower-cases and trims (SCN-002)', () => {
  assert.strictEqual(logic.normaliseTag('  Article '), 'article');
  assert.strictEqual(logic.normaliseTag('PYTHON'), 'python');
});

test('findDuplicate matches by canonical url (SCN-006)', () => {
  const list = [{ url: 'https://a.com/p', tags: [] }];
  assert.ok(logic.findDuplicate(list, 'https://a.com/p'));
  assert.strictEqual(logic.findDuplicate(list, 'https://b.com/'), null);
});

function make(over) {
  return Object.assign({ id: 1, url: 'https://a.com/', title: 'A', tags: [], readLater: false, read: false }, over);
}

test('filterBookmarks: search across title, url and tags (SCN-003)', () => {
  const list = [
    make({ id: 1, title: 'Cooking basics', url: 'https://food.com/x', tags: ['recipe'] }),
    make({ id: 2, title: 'Python guide', url: 'https://py.org/', tags: ['code'] }),
  ];
  assert.deepStrictEqual(logic.filterBookmarks(list, { search: 'python' }).map((b) => b.id), [2]);
  assert.deepStrictEqual(logic.filterBookmarks(list, { search: 'recipe' }).map((b) => b.id), [1]);
  assert.deepStrictEqual(logic.filterBookmarks(list, { search: 'food.com' }).map((b) => b.id), [1]);
  assert.strictEqual(logic.filterBookmarks(list, { search: 'zzz' }).length, 0);
});

test('filterBookmarks: tag filter (SCN-003)', () => {
  const list = [
    make({ id: 1, tags: ['read-later'] }),
    make({ id: 2, tags: ['tool'] }),
  ];
  assert.deepStrictEqual(logic.filterBookmarks(list, { tag: 'tool' }).map((b) => b.id), [2]);
});

test('filterBookmarks: read-later views only include read-later items (SCN-004)', () => {
  const list = [
    make({ id: 1, readLater: true, read: false }),
    make({ id: 2, readLater: true, read: true }),
    make({ id: 3, readLater: false, read: false }),
  ];
  assert.deepStrictEqual(logic.filterBookmarks(list, { view: 'unread' }).map((b) => b.id), [1]);
  assert.deepStrictEqual(logic.filterBookmarks(list, { view: 'read' }).map((b) => b.id), [2]);
  assert.deepStrictEqual(logic.filterBookmarks(list, { view: 'all' }).map((b) => b.id), [1, 2, 3]);
});

test('unreadCount counts only unread read-later items (SCN-004)', () => {
  const list = [
    make({ id: 1, readLater: true, read: false }),
    make({ id: 2, readLater: true, read: true }),
    make({ id: 3, readLater: false }),
  ];
  assert.strictEqual(logic.unreadCount(list), 1);
});

test('allTags returns sorted distinct tags (SCN-002)', () => {
  const list = [make({ tags: ['b', 'a'] }), make({ tags: ['a', 'c'] })];
  assert.deepStrictEqual(logic.allTags(list), ['a', 'b', 'c']);
});
