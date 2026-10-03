// T061 [US12]: import/export round-trip preserves title/tags/date; folders→tags; no dupes.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let porting, Bookmark;

before(async () => {
  // Point the DB at a throwaway dir before the model graph loads.
  process.env.BM_DATA_DIR = mkdtempSync(join(tmpdir(), 'bm-porting-'));
  porting = await import('../../src/server/services/porting.js');
  Bookmark = await import('../../src/server/models/bookmark.js');
});

const SAMPLE = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<DL><p>
  <DT><H3>Reading</H3>
  <DL><p>
    <DT><A HREF="https://example.com/a" ADD_DATE="1600000000" TAGS="work">Article A</A>
  </DL><p>
  <DT><A HREF="https://example.com/b" ADD_DATE="1600000500">Article B</A>
</DL><p>`;

test('import preserves title, tags (incl. folder), and original date added', () => {
  const result = porting.importHtml(Buffer.from(SAMPLE, 'utf8'));
  assert.equal(result.added, 2);
  assert.equal(result.skipped, 0);

  const a = Bookmark.getByUrl('https://example.com/a');
  assert.equal(a.title, 'Article A');
  // folder "Reading" + TAGS "work" both mapped
  assert.deepEqual([...a.tags].sort(), ['Reading', 'work']);
  assert.equal(a.date_added, new Date(1600000000 * 1000).toISOString());

  const b = Bookmark.getByUrl('https://example.com/b');
  assert.equal(b.date_added, new Date(1600000500 * 1000).toISOString());
});

test('export→import round-trip skips duplicates and keeps fields', () => {
  const all = Bookmark.allForView({ view: 'all', sort: 'date_added_asc' });
  const html = porting.exportHtml(all);
  assert.match(html, /ADD_DATE="1600000000"/);
  assert.match(html, /TAGS="/);

  // Re-importing the exported file must add nothing (all addresses already exist).
  const reimport = porting.importHtml(Buffer.from(html, 'utf8'));
  assert.equal(reimport.added, 0);
  assert.equal(reimport.skipped, all.length);
});
