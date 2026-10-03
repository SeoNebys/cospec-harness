import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { addTag, createBookmark, findDuplicate, normalizeUrl, paginate, parseWebUrl, searchAndFilter } from '../src/domain.js';
import { extractMetadata } from '../src/metadata.js';
import { BookmarkStore } from '../src/store.js';

test('validates and normalizes web addresses for duplicate comparison', () => {
  assert.equal(parseWebUrl('not a link'), null);
  assert.equal(parseWebUrl('ftp://example.com/file'), null);
  assert.equal(normalizeUrl('HTTPS://Example.COM:443/article#section'), 'https://example.com/article');
  const saved = createBookmark('https://example.com/article');
  assert.equal(findDuplicate([saved], 'https://EXAMPLE.com:443/article#other')?.id, saved.id);
});

test('creates enriched and basic bookmark records', () => {
  const enriched = createBookmark('https://example.com/article', {
    title: 'A useful page', description: 'Helpful context.', image: 'https://example.com/image.jpg', readingMinutes: 4
  });
  assert.equal(enriched.title, 'A useful page');
  assert.equal(enriched.isBasic, false);
  assert.equal(enriched.readingMinutes, 4);

  const basic = createBookmark('https://offline.example/article');
  assert.equal(basic.title, 'Untitled bookmark');
  assert.equal(basic.isBasic, true);
  assert.equal(basic.description, 'https://offline.example/article');
});

test('reuses canonical tag spelling without duplicate assignment', () => {
  const first = createBookmark('https://one.example', { title: 'One' });
  const second = createBookmark('https://two.example', { title: 'Two' });
  first.tags = ['Design'];
  const result = addTag([first, second], second.id, 'design');
  assert.equal(result.tag, 'Design');
  assert.equal(result.added, true);
  assert.deepEqual(second.tags, ['Design']);
  assert.equal(addTag([first, second], second.id, 'DESIGN').added, false);
});

test('searches all approved text fields and intersects tags and views', () => {
  const first = createBookmark('https://one.example', { title: 'Grid reference', description: 'Layout details' });
  const second = createBookmark('https://two.example', { title: 'Other', description: 'Unrelated' });
  first.tags = ['Design'];
  first.note = 'Use this while rebuilding the portfolio.';
  second.tags = ['Food'];
  assert.deepEqual(searchAndFilter([first, second], { query: 'rebuilding' }).map(item => item.id), [first.id]);
  assert.deepEqual(searchAndFilter([first, second], { query: 'grid', tag: 'Design' }).map(item => item.id), [first.id]);
  assert.equal(searchAndFilter([first, second], { query: 'grid', tag: 'Food' }).length, 0);
  first.archived = true;
  assert.equal(searchAndFilter([first, second], { view: 'all' }).includes(first), false);
  assert.equal(searchAndFilter([first, second], { view: 'archive' }).includes(first), true);
});

test('paginates large collections at a stable boundary', () => {
  const items = Array.from({ length: 41 }, (_, index) => index + 1);
  assert.deepEqual(paginate(items, 2, 20).items, items.slice(20, 40));
  assert.equal(paginate(items, 99, 20).currentPage, 3);
  assert.equal(paginate(items, 1, 20).pageCount, 3);
});

test('extracts recognizable metadata and reading time from HTML', () => {
  const html = `<!doctype html><html><head><title>Fallback title</title><meta property="og:title" content="Grid &amp; Layout"><meta name="description" content="A practical guide"><meta property="og:image" content="/cover.jpg"></head><body>${'<p>word '.repeat(450)}</body></html>`;
  const metadata = extractMetadata(html, 'https://example.com/article');
  assert.equal(metadata.title, 'Grid & Layout');
  assert.equal(metadata.description, 'A practical guide');
  assert.equal(metadata.image, 'https://example.com/cover.jpg');
  assert.ok(metadata.readingMinutes >= 2);
});

test('persists bookmark changes across store instances', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'lattice-store-'));
  const dataFile = join(directory, 'bookmarks.json');
  try {
    const writer = new BookmarkStore(dataFile);
    await writer.load();
    const bookmark = createBookmark('https://persistent.example/article', { title: 'Persistent page' });
    bookmark.tags = ['Reference'];
    bookmark.note = 'Keep this context.';
    writer.bookmarks.push(bookmark);
    await writer.save();

    const reader = new BookmarkStore(dataFile);
    await reader.load();
    assert.equal(reader.bookmarks.length, 1);
    assert.equal(reader.bookmarks[0].title, 'Persistent page');
    assert.deepEqual(reader.bookmarks[0].tags, ['Reference']);
    assert.equal(reader.bookmarks[0].note, 'Keep this context.');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
