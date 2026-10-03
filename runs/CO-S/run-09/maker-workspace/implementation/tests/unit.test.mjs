import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyCapturedPage,
  canonicalizeUrl,
  createBookmark,
  extractPage,
  matchesSearch,
  normalizeTags,
  parseWebUrl
} from '../src/bookmarks.mjs';

test('SCN-010 rejects malformed and non-web addresses', () => {
  assert.throws(() => parseWebUrl('not a link'), /complete web address/);
  assert.throws(() => parseWebUrl('file:///tmp/page'), /complete web address/);
  assert.equal(parseWebUrl('https://example.com/a').hostname, 'example.com');
});

test('SCN-012 canonical identity ignores referral details but preserves meaningful query values', () => {
  const plain = canonicalizeUrl('https://Example.com/article/');
  const referred = canonicalizeUrl('https://example.com/article/?utm_source=newsletter&fbclid=123#top');
  const different = canonicalizeUrl('https://example.com/article?page=2');
  assert.equal(plain, referred);
  assert.notEqual(plain, different);
});

test('SCN-014 tags are case-insensitively unique and retain known spelling', () => {
  assert.deepEqual(normalizeTags(['Design', 'design', 'READING'], ['design', 'reading']), ['design', 'reading']);
});

test('SCN-001 and SCN-009 extract enriched metadata and readable body text', () => {
  const page = extractPage(`
    <html><head><title>Fallback</title><meta property="og:title" content="Reader First">
    <meta name="description" content="A useful description"><meta property="og:image" content="/cover.jpg"></head>
    <body><nav>Noise</nav><article><p>This is a sufficiently long readable paragraph for the saved copy.</p></article></body></html>`, 'https://example.com/story');
  assert.equal(page.title, 'Reader First');
  assert.equal(page.description, 'A useful description');
  assert.equal(page.preview, 'https://example.com/cover.jpg');
  assert.deepEqual(page.archive.body, ['This is a sufficiently long readable paragraph for the saved copy.']);
});

test('SCN-003 searches title, description, and personal notes', () => {
  const bookmark = createBookmark({ url: 'https://example.com', title: 'Deep Work', description: 'Humane tools', note: 'Workshop reference' });
  assert.equal(matchesSearch(bookmark, 'deep'), true);
  assert.equal(matchesSearch(bookmark, 'humane'), true);
  assert.equal(matchesSearch(bookmark, 'workshop'), true);
  assert.equal(matchesSearch(bookmark, 'volcano'), false);
});

test('SCN-010 later capture never overwrites manually entered context', () => {
  const bookmark = createBookmark({
    url: 'https://example.com/offline', title: 'My title', description: 'My description', note: 'My note', manualContext: true,
    archive: { status: 'pending' }
  });
  const updated = applyCapturedPage(bookmark, {
    title: 'Remote title', description: 'Remote description', source: 'example.com', icon: '/icon', preview: '/image',
    archive: { status: 'ready', capturedAt: new Date().toISOString(), body: ['Readable body content that is now available.'] }
  });
  assert.equal(updated.title, 'My title');
  assert.equal(updated.description, 'My description');
  assert.equal(updated.note, 'My note');
  assert.equal(updated.archive.status, 'ready');
});
