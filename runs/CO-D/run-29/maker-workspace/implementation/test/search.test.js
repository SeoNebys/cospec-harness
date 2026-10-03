import test from 'node:test';
import assert from 'node:assert/strict';
import { searchBookmarks } from '../lib/search.js';

const bookmarks = [
  bookmark('rome-article', 'A Perfect Day in Rome', 'Morning espresso and a sunset stroll through Trastevere.', 'https://afar.com/rome', ['travel', 'article'], 'Plan this for our anniversary.'),
  bookmark('rome-book', 'An Architecture Lover’s Guide to Rome', 'Ancient monuments and modern landmarks.', 'https://monocle.com/rome', ['travel', 'book'], 'Recommended by Maya.'),
  bookmark('pasta', 'Pasta alla Gricia', 'A Roman pasta made with guanciale.', 'https://seriouseats.com/pasta', ['recipe', 'Rome'], 'Make this Friday.'),
  bookmark('music', 'The Story of Rock and Roll', 'A joyful history of popular music.', 'https://longreads.com/music', ['music', 'article'], '')
];

test('SCN-006: ordinary search ignores case across visible fields', () => {
  assert.deepEqual(searchBookmarks(bookmarks, 'ROME').results.map(item => item.id), ['rome-article', 'rome-book']);
  assert.deepEqual(searchBookmarks(bookmarks, 'seriouseats.com').results.map(item => item.id), ['pasta']);
});

test('SCN-006: note-only matches contain an explanatory excerpt', () => {
  const result = searchBookmarks(bookmarks, 'anniversary').results[0];
  assert.equal(result.id, 'rome-article');
  assert.match(result.matchExcerpt, /anniversary/);
});

test('SCN-007: # matches a complete tag without regard to case', () => {
  assert.deepEqual(searchBookmarks(bookmarks, '#TRAVEL').results.map(item => item.id), ['rome-article', 'rome-book']);
});

test('SCN-007: compact tags are OR while words remain required', () => {
  assert.deepEqual(searchBookmarks(bookmarks, 'Rome #article #book').results.map(item => item.id), ['rome-article', 'rome-book']);
});

test('SCN-007: explicit grouping and exclusion are evaluated', () => {
  assert.deepEqual(searchBookmarks(bookmarks, 'Rome AND (#article OR #book)').results.map(item => item.id), ['rome-article', 'rome-book']);
  assert.deepEqual(searchBookmarks(bookmarks, 'Rome AND NOT #book').results.map(item => item.id), ['rome-article']);
});

test('SCN-007: quoted operator words are exact searchable text', () => {
  assert.deepEqual(searchBookmarks(bookmarks, '"rock and roll"').results.map(item => item.id), ['music']);
});

test('SCN-012: complete zero-match and incomplete expressions differ', () => {
  assert.deepEqual(searchBookmarks(bookmarks, 'volcano'), { status: 'ok', results: [] });
  const incomplete = searchBookmarks(bookmarks, 'Rome AND (');
  assert.equal(incomplete.status, 'incomplete');
  assert.match(incomplete.message, /finish/i);
});

function bookmark(id, title, description, address, tags, notes) {
  return { id, title, description, address, tags, notes };
}
