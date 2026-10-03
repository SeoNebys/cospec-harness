import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let db, buildFilter, getOrCreateTag;

before(async () => {
  process.env.DATA_DIR = mkdtempSync(join(tmpdir(), 'bm-search-'));
  ({ db } = await import('../../server/db/db.js'));
  ({ getOrCreateTag } = await import('../../server/api/tags.js'));
  ({ buildFilter } = await import('../../server/api/bookmarks.js'));

  const now = Date.now();
  const ins = db.prepare(
    `INSERT INTO bookmarks (url, url_key, title, description, note, created_at, updated_at) VALUES (?,?,?,?,?,?,?)`
  );
  const b1 = ins.run('https://a.com/1', 'k1', 'Quarterly report', 'annual finance', '', now, now).lastInsertRowid;
  const b2 = ins.run('https://a.com/2', 'k2', 'Cat photos', 'cute cats', '', now, now).lastInsertRowid;
  const b3 = ins.run('https://a.com/3', 'k3', 'Report draft', 'work in progress', '', now, now).lastInsertRowid;
  const work = getOrCreateTag('work');
  db.prepare('INSERT INTO bookmark_tags (bookmark_id, tag_id) VALUES (?,?)').run(b1, work.id);
  db.prepare('INSERT INTO bookmark_tags (bookmark_id, tag_id) VALUES (?,?)').run(b3, work.id);
});

after(() => { try { db.close(); } catch {} });

function search(q) {
  const { where, params } = buildFilter({ view: 'main', q });
  return db.prepare(`SELECT b.id FROM bookmarks b WHERE ${where}`).all(...params).map(r => r.id);
}

test('keyword search is case-insensitive across fields', () => {
  assert.equal(search('QUARTERLY').length, 1);
  assert.equal(search('cats').length, 1);
});

test('#tag filter', () => {
  assert.equal(search('#work').length, 2);
});

test('boolean AND / OR / NOT with parentheses', () => {
  assert.equal(search('#work AND report').length, 2);      // b1, b3
  assert.equal(search('#work NOT draft').length, 1);        // b1 only
  assert.equal(search('cats OR draft').length, 2);          // b2, b3
});

test('quoted phrase literal', () => {
  assert.equal(search('"Quarterly report"').length, 1);
});
