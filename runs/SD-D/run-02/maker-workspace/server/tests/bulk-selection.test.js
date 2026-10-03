import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeDb } from './helpers.js';
import { createBookmark, updateBookmark } from '../src/models/bookmark.js';
import { resolveView } from '../src/lib/viewQuery.js';

function seed(db) {
  // 1 normal js+promise, 2 normal js only, 3 normal go, 4 unread js,
  // 5 archived js. Give distinct urls.
  const mk = (url, opts = {}) => {
    const { row } = createBookmark(db, { url, title: opts.title, tags: opts.tags });
    if (opts.read_state) updateBookmark(db, row.id, { read_state: opts.read_state });
    if (opts.archived) updateBookmark(db, row.id, { archived: true });
    return row.id;
  };
  return {
    a: mk('https://a.com', { title: 'promise chains', tags: ['js'], read_state: 'read' }),
    b: mk('https://b.com', { title: 'callbacks', tags: ['js'], read_state: 'read' }),
    c: mk('https://c.com', { title: 'goroutines', tags: ['go'], read_state: 'read' }),
    d: mk('https://d.com', { title: 'promise unread', tags: ['js'] }), // unread
    e: mk('https://e.com', { title: 'promise archived', tags: ['js'], archived: true }),
  };
}

const idsOf = (res) => new Set(res.rows.map((r) => r.id));

test('view scope excludes archived from normal', (t) => {
  const db = makeDb(t);
  const id = seed(db);
  const res = resolveView(db, { view: 'normal' });
  const got = idsOf(res);
  assert.equal(got.has(id.e), false, 'archived excluded from normal');
  assert.equal(got.has(id.a), true);
});

test('unread view returns only unread non-archived', (t) => {
  const db = makeDb(t);
  const id = seed(db);
  const res = resolveView(db, { view: 'unread' });
  assert.deepEqual(idsOf(res), new Set([id.d]));
});

test('archived view returns only archived', (t) => {
  const db = makeDb(t);
  const id = seed(db);
  const res = resolveView(db, { view: 'archived' });
  assert.deepEqual(idsOf(res), new Set([id.e]));
});

test('clicked tag filter narrows the set', (t) => {
  const db = makeDb(t);
  const id = seed(db);
  const res = resolveView(db, { view: 'normal', tag: 'go' });
  assert.deepEqual(idsOf(res), new Set([id.c]));
});

test('search words combine with view scope (AND across facets)', (t) => {
  const db = makeDb(t);
  const id = seed(db);
  // normal view + word "promise" -> a and d (both non-archived); e is archived.
  const res = resolveView(db, { view: 'normal', q: 'promise' });
  assert.deepEqual(idsOf(res), new Set([id.a, id.d]));
});

test('include/exclude tags honored (saved-search style)', (t) => {
  const db = makeDb(t);
  const id = seed(db);
  // include js, exclude go across normal view (a, b, d are non-archived js).
  const res = resolveView(db, { view: 'normal', includeTags: ['js'], excludeTags: ['go'] });
  assert.deepEqual(idsOf(res), new Set([id.a, id.b, id.d]));
});

test('resolveView returns the COMPLETE matching set (no pagination)', (t) => {
  const db = makeDb(t);
  for (let i = 0; i < 60; i++) createBookmark(db, { url: `https://n${i}.com`, tags: ['bulk'] });
  const res = resolveView(db, { view: 'normal', tag: 'bulk' });
  assert.equal(res.rows.length, 60, 'all matching items returned regardless of page size');
});
