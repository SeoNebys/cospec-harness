import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTestDb } from '../../src/db/index.js';
import { parseNetscape, importEntries, exportNetscape } from '../../src/services/importExport.js';
import { createBookmark, updateBookmark, getById } from '../../src/models/bookmark.js';
import { getRawByKey, rowToBookmark } from '../../src/models/bookmark.js';
import { normalizeKey } from '../../src/services/url.js';
import { tagsForBookmark } from '../../src/models/tag.js';

const SAMPLE = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<DL><p>
  <DT><H3>Reading</H3>
  <DL><p>
    <DT><A HREF="https://a.com/" ADD_DATE="1600000000" TAGS="news,tech">Site A</A>
    <DT><A HREF="https://b.com/page" ADD_DATE="1600000100">Site B</A>
  </DL><p>
</DL><p>`;

test('parseNetscape extracts url/title/date/tags and folder-as-tag', () => {
  const entries = parseNetscape(SAMPLE);
  assert.equal(entries.length, 2);
  assert.equal(entries[0].url, 'https://a.com/');
  assert.deepEqual(entries[0].tags, ['news', 'tech']);
  // Site B has no TAGS attr -> inherits folder "Reading"
  assert.deepEqual(entries[1].tags, ['Reading']);
});

test('import adds new and retains dates (FR-035)', () => {
  const db = createTestDb();
  const summary = importEntries(parseNetscape(SAMPLE), db);
  assert.equal(summary.added, 2);
  assert.equal(summary.merged, 0);
  const a = rowToBookmark(getRawByKey(normalizeKey('https://a.com/'), db), db);
  assert.deepEqual(a.tags.sort(), ['news', 'tech']);
  assert.equal(a.created_at, new Date(1600000000 * 1000).toISOString());
});

test('merge keeps existing fields, adds only missing tags (FR-036)', () => {
  const db = createTestDb();
  // Pre-existing bookmark for a.com with own title/description and one tag.
  const existing = createBookmark(
    { url: 'https://a.com/', title: 'My Title', description: 'mine', tags: ['news'] },
    db
  );
  updateBookmark(existing.id, { is_read: true }, db);

  const summary = importEntries(parseNetscape(SAMPLE), db);
  assert.equal(summary.merged, 1);
  assert.equal(summary.added, 1); // only b.com added

  const after = getById(existing.id, db);
  assert.equal(after.title, 'My Title', 'existing title kept');
  assert.equal(after.description, 'mine', 'existing description kept');
  assert.equal(after.is_read, true, 'existing read status kept');
  // "news" already present, "tech" added.
  assert.deepEqual(after.tags.sort(), ['news', 'tech']);
});

test('export round-trips titles, tags, dates (FR-037/SC-007)', () => {
  const db = createTestDb();
  importEntries(parseNetscape(SAMPLE), db);
  const html = exportNetscape(db);
  assert.match(html, /HREF="https:\/\/a.com\/"/);
  assert.match(html, /TAGS="news,tech"/);
  assert.match(html, /Site A</);
  assert.match(html, /ADD_DATE="1600000000"/);
});
