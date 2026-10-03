import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { parse, buildWhere } from '../../server/services/search.js';

// Build a tiny in-memory DB to evaluate compiled WHERE fragments end-to-end.
// Uses Node's built-in node:sqlite (avoids the native better-sqlite3 finalizer
// crash under the node:test runner); the compiled SQL is identical in production.
function makeDb() {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE bookmarks (id INTEGER PRIMARY KEY, url TEXT, title TEXT,
      description TEXT DEFAULT '', notes_text TEXT DEFAULT '');
    CREATE TABLE tags (id INTEGER PRIMARY KEY, name TEXT COLLATE NOCASE UNIQUE);
    CREATE TABLE bookmark_tags (bookmark_id INTEGER, tag_id INTEGER);
  `);
  return db;
}

function seed(db) {
  const ins = db.prepare('INSERT INTO bookmarks (id,url,title,description,notes_text) VALUES (?,?,?,?,?)');
  ins.run(1, 'https://a.com/climate', 'Climate news today', 'global warming', '');
  ins.run(2, 'https://b.com/ml', 'Intro to machine learning', 'a primer', 'notes here');
  ins.run(3, 'https://c.com/opinion', 'Climate opinion piece', 'editorial', '');
  ins.run(4, 'https://d.com/and-or', 'Boolean and or logic', 'circuits', '');
  const tag = db.prepare('INSERT INTO tags (id,name) VALUES (?,?)');
  tag.run(1, 'news'); tag.run(2, 'blog');
  const bt = db.prepare('INSERT INTO bookmark_tags VALUES (?,?)');
  bt.run(1, 1); // #news -> bookmark 1
  bt.run(2, 2); // #blog -> bookmark 2
}

function ids(db, query) {
  const { sql, params } = buildWhere(query);
  const rows = db.prepare(`SELECT id FROM bookmarks b WHERE ${sql} ORDER BY id`).all(...params);
  return rows.map((r) => r.id);
}

// Run a callback against a freshly seeded DB, always closing it afterward
// (better-sqlite3 asserts at process exit if a connection is left open).
function withDb(fn) {
  const db = makeDb();
  seed(db);
  try { fn(db); } finally { db.close(); }
}

test('bare word matches across fields, case-insensitive', () => {
  withDb((db) => {
    assert.deepEqual(ids(db, 'climate'), [1, 3]);
    assert.deepEqual(ids(db, 'CLIMATE'), [1, 3]);
  });
});

test('implicit AND between adjacent words', () => {
  withDb((db) => assert.deepEqual(ids(db, 'climate news'), [1]));
});

test('exact phrase', () => {
  withDb((db) => {
    assert.deepEqual(ids(db, '"machine learning"'), [2]);
    assert.deepEqual(ids(db, '"learning machine"'), []);
  });
});

test('#tag matches', () => {
  withDb((db) => {
    assert.deepEqual(ids(db, '#news'), [1]);
    assert.deepEqual(ids(db, '#missing'), []);
  });
});

test('boolean with grouping and NOT', () => {
  withDb((db) => assert.deepEqual(ids(db, '(#news OR #blog) AND climate NOT opinion'), [1]));
});

test('quoted operator word is literal, not an operator', () => {
  // bookmark 4 title contains "and or"; searching literal "and" should match it
  withDb((db) => assert.deepEqual(ids(db, '"and"'), [4]));
});

test('empty query yields match-all fragment', () => {
  assert.equal(parse('   '), null);
  const { isEmpty } = buildWhere('');
  assert.equal(isEmpty, true);
});

test('malformed input throws (no crash), caller maps to message', () => {
  assert.throws(() => buildWhere('(a AND'), SyntaxError);
  assert.throws(() => buildWhere('a AND'), SyntaxError);
  assert.throws(() => buildWhere('a)'), SyntaxError);
});
