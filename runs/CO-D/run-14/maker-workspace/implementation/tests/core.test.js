import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SearchSyntaxError, applyRecoveredDetails, extractPage, makeBookmark, normalizeTag, normalizeUrl,
  parseSearch, parseWebAddress, searchBookmarks, uniqueTags
} from '../src/core.js';

test('SCN-018 accepts only complete http and https addresses', () => {
  assert.equal(parseWebAddress('').ok, false);
  assert.equal(parseWebAddress('notes from rome').ok, false);
  assert.equal(parseWebAddress('ftp://example.com').ok, false);
  assert.equal(parseWebAddress('https://example.com/rome').ok, true);
});

test('SCN-002 and SCN-016 normalize trailing slashes and known tracking only', () => {
  const original = normalizeUrl('https://Example.com/rome/');
  assert.equal(original, normalizeUrl('https://example.com/rome?utm_source=newsletter&utm_campaign=autumn'));
  assert.notEqual(original, normalizeUrl('https://example.com/rome?page=2'));
});

test('SCN-003 and SCN-004 normalize and deduplicate tags', () => {
  assert.equal(normalizeTag(' Florence '), 'florence');
  assert.deepEqual(uniqueTags(['Travel', ' travel ', 'BOOKS']), ['travel', 'books']);
});

const bookmarks = [
  makeBookmark({ url: 'https://example.com/rome', details: { title: 'Rome guide', description: 'Quiet streets', archive: {} }, tags: ['articles', 'travel'], notes: '' }),
  makeBookmark({ url: 'https://example.com/italy', details: { title: 'Four roads', description: 'Literary journeys', archive: {} }, tags: ['books', 'travel'], notes: 'For the Rome trip' }),
  makeBookmark({ url: 'https://example.com/water', details: { title: 'Ancient water', description: 'Daily life in Rome', archive: {} }, tags: ['articles', 'research'], notes: '' }),
  makeBookmark({ url: 'https://example.com/bookseller', details: { title: 'A bookseller guide', description: 'The word books is here', archive: {} }, tags: ['shopping'], notes: '' })
];

test('SCN-005 broad search covers title, description, notes and URL case-insensitively', () => {
  assert.equal(searchBookmarks(bookmarks, 'ROME').bookmarks.length, 3);
  assert.equal(searchBookmarks(bookmarks, 'quiet').bookmarks.length, 1);
  assert.equal(searchBookmarks(bookmarks, 'example.com/water').bookmarks.length, 1);
});

test('SCN-006 and SCN-007 support grouped exact tags and exclusion', () => {
  const result = searchBookmarks(bookmarks, 'Rome AND (tag:articles OR tag:books) AND NOT tag:travel');
  assert.deepEqual(result.bookmarks.map(item => item.title), ['Ancient water']);
  assert.equal(searchBookmarks(bookmarks, 'tag:books').bookmarks.some(item => item.title === 'A bookseller guide'), false);
  assert.match(result.interpretation[0], /exclude tag exactly/i);
});

test('SCN-008 treats quoted operator words as a literal phrase', () => {
  const items = [
    makeBookmark({ url: 'https://example.com/law', details: { title: 'Law and Order in the City', archive: {} }, tags: [] }),
    makeBookmark({ url: 'https://example.com/order', details: { title: 'Order and law', archive: {} }, tags: [] })
  ];
  assert.deepEqual(searchBookmarks(items, '"LAW and ORDER"').bookmarks.map(item => item.title), ['Law and Order in the City']);
});

test('SCN-014 rejects malformed search expressions with useful errors', () => {
  assert.throws(() => parseSearch('Rome AND (tag:articles OR'), error => error instanceof SearchSyntaxError && /After “OR/.test(error.message));
  assert.throws(() => parseSearch('"unfinished'), error => /Close the quoted phrase/.test(error.message));
});

test('SCN-001 and SCN-010 extract page details and readable archive content', () => {
  const html = `<!doctype html><title>Example article</title><meta name="description" content="A useful page"><meta name="author" content="A. Writer"><article><p>First useful paragraph.</p><p>Second useful paragraph.</p></article>`;
  const details = extractPage(html, 'https://example.com/article');
  assert.equal(details.title, 'Example article');
  assert.equal(details.description, 'A useful page');
  assert.equal(details.archive.author, 'A. Writer');
  assert.match(details.archive.paragraphs.join(' '), /First useful paragraph/);
});

test('SCN-013 protects a manual pending title while leaving blank discovered fields fillable', () => {
  const pending = makeBookmark({ url: 'https://offline.example/article', title: 'My title', description: '', notes: 'Retry later', tags: [], captureStatus: 'pending' });
  assert.equal(pending.titleEdited, true);
  assert.equal(pending.descriptionEdited, false);
  assert.equal(pending.capture.status, 'pending');
  applyRecoveredDetails(pending, { title: 'Page title', description: 'Recovered description', icon: '/icon.png', image: '', archive: { title: 'Page title', paragraphs: ['Recovered'] } });
  assert.equal(pending.title, 'My title');
  assert.equal(pending.description, 'Recovered description');
  assert.equal(pending.capture.status, 'ready');
});
