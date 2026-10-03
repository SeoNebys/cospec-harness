// DB-backed import/export tests. Run with the Node test runner in-process
// (`node tests/node/import-export.test.js`) so the native better-sqlite3 handle
// tears down on a normal process exit rather than a forced worker kill.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bm-imp-'));
process.env.BOOKMARKS_DATA_DIR = tmp;
process.env.BOOKMARKS_DB_MEMORY = '1';

const importExport = await import('../../src/services/importExport.js');

const SAMPLE = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<DL><p>
  <DT><H3>Work</H3>
  <DL><p>
    <DT><A HREF="https://example.com/a" ADD_DATE="1600000000" TAGS="report">Alpha</A>
    <DT><A HREF="https://example.com/b/" ADD_DATE="1600000100">Beta</A>
  </DL><p>
  <DT><A HREF="https://example.com/c" ADD_DATE="1600000200">Gamma</A>
</DL><p>`;

test('maps folders and TAGS to tags and ADD_DATE to created dates', () => {
  const recs = importExport.parseNetscape(SAMPLE);
  const alpha = recs.find((r) => r.url === 'https://example.com/a');
  assert.equal(alpha.title, 'Alpha');
  assert.ok(alpha.tags.includes('Work'));
  assert.ok(alpha.tags.includes('report'));
  assert.equal(alpha.createdAt, new Date(1600000000 * 1000).toISOString());
});

test('imports records and preserves dates', () => {
  const res = importExport.importNetscape(SAMPLE);
  assert.equal(res.imported, 3);
  assert.equal(res.skipped, 0);
});

test('skips duplicates by normalized key on a second import', () => {
  const res = importExport.importNetscape(SAMPLE);
  assert.equal(res.imported, 0);
  assert.equal(res.skipped, 3);
});

test('round-trips through export preserving titles, tags, and dates', () => {
  const html = importExport.exportNetscape();
  assert.match(html, /HREF="https:\/\/example\.com\/a"/);
  assert.match(html, /Alpha/);
  assert.match(html, /TAGS="[^"]*Work[^"]*"/);
  assert.match(html, /TAGS="[^"]*report[^"]*"/);
  assert.match(html, /ADD_DATE="1600000000"/);
  const recs = importExport.parseNetscape(html);
  const a = recs.find((r) => r.url === 'https://example.com/a');
  assert.equal(a.createdAt, new Date(1600000000 * 1000).toISOString());
});
