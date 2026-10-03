import { test, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
process.env.BOOKMARKS_DB = join(tmpdir(), `bm-unit-${process.pid}-${Date.now()}.db`);

import { migrate, getDb } from '../../src/db/index.js';
import { importNetscapeHtml } from '../../src/services/importer.js';
import { exportNetscapeHtml } from '../../src/services/exporter.js';

before(() => { migrate(); });
beforeEach(() => {
  const db = getDb();
  db.exec('DELETE FROM bookmark_tags; DELETE FROM bookmark; DELETE FROM tag;');
});

const SAMPLE = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<DL><p>
  <DT><A HREF="https://a.com/x" ADD_DATE="1600000000" TAGS="news,tech">Site A</A>
  <DT><A HREF="https://b.com/y" ADD_DATE="1600000100">Site B</A>
  <DT><A>broken entry</A>
</DL><p>`;

test('import preserves titles, tags and dates; reports failures', () => {
  const result = importNetscapeHtml(SAMPLE);
  assert.equal(result.imported, 2);
  assert.equal(result.failed.length, 1);
  const rows = getDb().prepare('SELECT * FROM bookmark ORDER BY url').all();
  assert.equal(rows[0].title, 'Site A');
  assert.equal(new Date(rows[0].date_added).getTime(), 1600000000 * 1000);
  const tags = getDb().prepare('SELECT t.name FROM tag t JOIN bookmark_tags bt ON bt.tag_id=t.id WHERE bt.bookmark_id=?').all(rows[0].id).map((r) => r.name).sort();
  assert.deepEqual(tags, ['news', 'tech']);
});

test('import skips duplicates', () => {
  importNetscapeHtml(SAMPLE);
  const again = importNetscapeHtml(SAMPLE);
  assert.equal(again.imported, 0);
  assert.equal(again.skippedDuplicates, 2);
});

test('export round-trips (re-import produces no new entries)', () => {
  importNetscapeHtml(SAMPLE);
  const html = exportNetscapeHtml();
  assert.match(html, /Site A/);
  assert.match(html, /TAGS="news,tech"/);
  const reimport = importNetscapeHtml(html);
  assert.equal(reimport.imported, 0);
  assert.equal(reimport.skippedDuplicates, 2);
});
