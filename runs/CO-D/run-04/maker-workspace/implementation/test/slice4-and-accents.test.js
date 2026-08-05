import { test } from 'node:test';
import assert from 'node:assert/strict';
import { poolForView, unreadCount, asideCount, matchesQuery, fold } from '../extension/src/query.js';
import { statusOf, isAside } from '../extension/src/core.js';

const lib = [
  { id: 1, title: 'Sourdough', url: 'https://x/1', tags: ['recipes'], status: 'none', aside: false },
  { id: 2, title: 'Kyoto', url: 'https://x/2', tags: ['travel'], status: 'unread', aside: false },
  { id: 3, title: 'Stripe API', url: 'https://x/3', tags: ['work'], status: 'unread', aside: false },
  { id: 4, title: 'Old talk', url: 'https://x/4', tags: ['dev'], status: 'none', aside: true },       // shelved
  { id: 5, title: 'Read piece', url: 'https://x/5', tags: ['work'], status: 'read', aside: false },
  { id: 6, title: 'Shelved unread', url: 'https://x/6', tags: [], status: 'unread', aside: true },     // shelved + unread
];

test('SCN-010/013: Everything excludes shelved links', () => {
  assert.deepEqual(poolForView(lib, 'all').map((l) => l.id), [1, 2, 3, 5]);
});

test('SCN-010: To-read pile is unread & not shelved', () => {
  assert.deepEqual(poolForView(lib, 'toread').map((l) => l.id), [2, 3]); // #6 shelved -> excluded
});

test('SCN-013: the shelf shows only set-aside links', () => {
  assert.deepEqual(poolForView(lib, 'aside').map((l) => l.id), [4, 6]);
});

test('lens counts: unread ignores shelved; aside counts shelf', () => {
  assert.equal(unreadCount(lib), 2); // #2,#3 (not #6, it's shelved)
  assert.equal(asideCount(lib), 2);  // #4,#6
});

test('SCN-013: shelved links are excluded from everyday search too', () => {
  // searching Everything's pool should never surface a shelved link
  const everyday = poolForView(lib, 'all');
  assert.ok(!everyday.some((l) => l.id === 4));
});

test('accent-fold: "cafe" finds "café", and it is symmetric', () => {
  assert.equal(fold('Résumé CAFÉ'), 'resume cafe');
  assert.ok(matchesQuery({ title: 'Best Café', url: 'https://x', tags: [] }, 'cafe'));
  assert.ok(matchesQuery({ title: 'Best cafe', url: 'https://x', tags: [] }, 'café'));
});

test('status/aside accessors tolerate older records missing the fields', () => {
  assert.equal(statusOf({}), 'none');
  assert.equal(isAside({}), false);
});
