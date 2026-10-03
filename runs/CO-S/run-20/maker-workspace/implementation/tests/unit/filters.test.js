import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeUrl, sameUrl, matchesQuery, allTopics, filterItems, archivedCount,
} from '../../public/shared/filters.js';

const sample = () => [
  { id: 1, url: 'https://a.com/x', title: 'Roast Chicken', description: 'crispy skin', note: 'sunday', topics: ['Cooking', 'Weeknight'], unread: true, archived: false, created: 10 },
  { id: 2, url: 'https://b.com/y', title: 'Flexbox Guide', description: 'css layout', note: '', topics: ['Programming', 'CSS'], unread: false, archived: false, created: 20 },
  { id: 3, url: 'https://c.com/z', title: 'Old Tax Guide', description: 'reference', note: 'outdated', topics: ['Finance'], unread: false, archived: true, created: 5 },
];

test('normalizeUrl trims, lowercases, drops trailing slashes', () => {
  assert.equal(normalizeUrl('  HTTPS://A.com/Path/// '), 'https://a.com/path');
});

test('sameUrl treats trailing slash and case as equal (SCN-009)', () => {
  assert.ok(sameUrl('https://x.com/a', 'HTTPS://x.com/a/'));
  assert.ok(!sameUrl('https://x.com/a', 'https://x.com/b'));
});

test('matchesQuery searches title, description, note and address (SCN-002)', () => {
  const it = sample()[0];
  assert.ok(matchesQuery(it, 'roast'));      // title
  assert.ok(matchesQuery(it, 'crispy'));     // description
  assert.ok(matchesQuery(it, 'sunday'));     // note
  assert.ok(matchesQuery(it, 'a.com'));      // address
  assert.ok(!matchesQuery(it, 'zzz'));
  assert.ok(matchesQuery(it, ''));           // empty matches all
});

test('allTopics returns distinct sorted topics (SCN-003)', () => {
  assert.deepEqual(allTopics(sample()), ['Cooking', 'CSS', 'Finance', 'Programming', 'Weeknight']);
});

test('collection scope excludes archived and sorts newest first (SCN-005/SCN-001)', () => {
  const out = filterItems(sample(), {});
  assert.deepEqual(out.map((i) => i.id), [2, 1]);
});

test('archive scope shows only archived (SCN-005)', () => {
  const out = filterItems(sample(), { scope: 'archive' });
  assert.deepEqual(out.map((i) => i.id), [3]);
});

test('status filter narrows to reading queue (SCN-004)', () => {
  assert.deepEqual(filterItems(sample(), { status: 'unread' }).map((i) => i.id), [1]);
  assert.deepEqual(filterItems(sample(), { status: 'read' }).map((i) => i.id), [2]);
});

test('topic filter and search combine (SCN-003 + SCN-002)', () => {
  const items = sample();
  assert.deepEqual(filterItems(items, { topic: 'Cooking' }).map((i) => i.id), [1]);
  assert.deepEqual(filterItems(items, { topic: 'Cooking', query: 'zzz' }).map((i) => i.id), []);
  assert.deepEqual(filterItems(items, { topic: 'CSS', query: 'layout' }).map((i) => i.id), [2]);
});

test('archived links never appear in collection search (SCN-005)', () => {
  const out = filterItems(sample(), { query: 'reference' }); // matches archived id 3 only
  assert.deepEqual(out.map((i) => i.id), []);
});

test('archivedCount counts archived links (SCN-005)', () => {
  assert.equal(archivedCount(sample()), 1);
});
