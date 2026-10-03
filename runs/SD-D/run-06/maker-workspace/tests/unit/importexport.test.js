import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';

// Isolate the DB to a temp file BEFORE importing any DB-touching module.
const DB = join(tmpdir(), `bm-importexport-${process.pid}-${Date.now()}.db`);
process.env.BOOKMARKS_DB = DB;

let migrate, importNetscape, exportNetscape, getDb, getTagsForBookmark;

before(async () => {
  ({ migrate } = await import('../../src/server/db/migrations.js'));
  ({ importNetscape } = await import('../../src/server/services/bookmarksImport.js'));
  ({ exportNetscape } = await import('../../src/server/services/bookmarksExport.js'));
  ({ getDb } = await import('../../src/server/db/connection.js'));
  ({ getTagsForBookmark } = await import('../../src/server/db/tags.repo.js'));
  migrate();
});

after(() => {
  for (const suffix of ['', '-wal', '-shm']) {
    try { rmSync(DB + suffix); } catch { /* ignore */ }
  }
});

const SAMPLE = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<DL><p>
  <DT><A HREF="https://example.com/a" ADD_DATE="1600000000" TAGS="news,tech">Example A</A>
  <DT><A HREF="https://example.org/b" ADD_DATE="1600000100">Example B</A>
</DL><p>`;

test('import preserves titles, tags, and original dates (FR-030)', () => {
  const result = importNetscape(SAMPLE);
  assert.equal(result.imported, 2);
  assert.equal(result.reconciled, 0);

  const row = getDb().prepare("SELECT * FROM bookmark WHERE normalized_url = 'https://example.com/a'").get();
  assert.ok(row, 'imported bookmark exists');
  assert.equal(row.title, 'Example A');
  assert.equal(new Date(row.date_added).getTime(), 1600000000 * 1000);
  assert.deepEqual(getTagsForBookmark(row.id).sort(), ['news', 'tech']);
});

test('re-import reconciles existing addresses with no duplicates (FR-031)', () => {
  const before = getDb().prepare('SELECT COUNT(*) AS n FROM bookmark').get().n;
  const result = importNetscape(SAMPLE);
  const after = getDb().prepare('SELECT COUNT(*) AS n FROM bookmark').get().n;
  assert.equal(result.imported, 0);
  assert.equal(result.reconciled, 2);
  assert.equal(after, before, 'no new rows created on re-import');
});

test('export produces a re-importable Netscape file with title/tags/date (FR-032)', () => {
  const html = exportNetscape();
  assert.match(html, /NETSCAPE-Bookmark-file-1/);
  assert.match(html, /HREF="https:\/\/example\.com\/a"/);
  assert.match(html, /ADD_DATE="1600000000"/);
  assert.match(html, /TAGS="news,tech"/);
  assert.match(html, />Example A</);

  // Round-trip: importing the export creates no duplicates.
  const r = importNetscape(html);
  assert.equal(r.imported, 0);
  assert.equal(r.reconciled, 2);
});
