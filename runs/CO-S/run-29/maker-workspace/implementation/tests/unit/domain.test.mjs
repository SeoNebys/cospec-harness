import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addBookmark,
  assignToCollection,
  createCollectionAndAssign,
  deleteBookmarks,
  findBookmarks,
  normalizeWebAddress,
  sanitizeState,
  validateBookmarkDraft,
  validateCollectionName
} from '../../public/domain.js';
import { loadState, saveState, STORAGE_KEY } from '../../public/storage.js';

const empty = () => ({ bookmarks: [], collections: [] });

test('SCN-001 adds a trimmed named bookmark', () => {
  const result = addBookmark(empty(), { name: '  MDN Web Docs  ', url: 'https://developer.mozilla.org' }, 'b1');
  assert.deepEqual(result.errors, {});
  assert.deepEqual(result.bookmark, {
    id: 'b1', name: 'MDN Web Docs', url: 'https://developer.mozilla.org', collectionId: null
  });
});

test('SCN-005 rejects missing names and incomplete or duplicate addresses', () => {
  const invalid = validateBookmarkDraft({ name: '', url: 'developer.mozilla.org' }, []);
  assert.equal(invalid.valid, false);
  assert.match(invalid.errors.name, /name/i);
  assert.match(invalid.errors.url, /http:\/\//i);

  const bookmarks = [{ id: 'b1', name: 'MDN Web Docs', url: 'https://developer.mozilla.org/', collectionId: null }];
  const duplicate = validateBookmarkDraft({ name: 'Copy', url: 'https://developer.mozilla.org' }, bookmarks);
  assert.match(duplicate.errors.duplicate, /MDN Web Docs/);
  assert.equal(normalizeWebAddress(bookmarks[0].url), normalizeWebAddress('https://developer.mozilla.org'));
});

test('SCN-002 creates a unique collection and assigns selected bookmarks', () => {
  const state = {
    bookmarks: [
      { id: 'b1', name: 'MDN', url: 'https://developer.mozilla.org', collectionId: null },
      { id: 'b2', name: 'CSS', url: 'https://css-tricks.com', collectionId: null },
      { id: 'b3', name: 'Recipes', url: 'https://food.example', collectionId: null }
    ],
    collections: []
  };
  const result = createCollectionAndAssign(state, 'Web development', ['b1', 'b2'], 'c1');
  assert.equal(result.collection.name, 'Web development');
  assert.equal(result.state.bookmarks.find(({ id }) => id === 'b1').collectionId, 'c1');
  assert.equal(result.state.bookmarks.find(({ id }) => id === 'b3').collectionId, null);
});

test('SCN-007 assigns later bookmarks to an existing collection', () => {
  const state = {
    collections: [{ id: 'c1', name: 'Web development' }],
    bookmarks: [{ id: 'b1', name: 'web.dev', url: 'https://web.dev', collectionId: null }]
  };
  const next = assignToCollection(state, 'c1', ['b1']);
  assert.equal(next.bookmarks[0].collectionId, 'c1');
});

test('SCN-008 rejects blank and case-insensitive duplicate collection names', () => {
  const collections = [{ id: 'c1', name: 'Web development' }];
  assert.match(validateCollectionName('', collections).errors.name, /name/i);
  assert.match(validateCollectionName('web DEVELOPMENT', collections).errors.duplicate, /already exists/i);
});

test('SCN-003 combines partial search across name and address with a collection filter', () => {
  const state = {
    collections: [{ id: 'c1', name: 'Web' }, { id: 'c2', name: 'Reading' }],
    bookmarks: [
      { id: 'b1', name: 'CSS-Tricks', url: 'https://css-tricks.com', collectionId: 'c1' },
      { id: 'b2', name: 'MDN', url: 'https://developer.mozilla.org/css', collectionId: 'c1' },
      { id: 'b3', name: 'CSS book', url: 'https://books.example', collectionId: 'c2' }
    ]
  };
  assert.deepEqual(findBookmarks(state, { search: 'css', collectionId: 'c1' }).map(({ id }) => id), ['b1', 'b2']);
  assert.deepEqual(findBookmarks(state, { search: 'tricks', collectionId: 'c1' }).map(({ id }) => id), ['b1']);
});

test('SCN-004 deletes exactly the chosen bookmarks', () => {
  const state = {
    collections: [],
    bookmarks: [
      { id: 'b1', name: 'One', url: 'https://one.example', collectionId: null },
      { id: 'b2', name: 'Two', url: 'https://two.example', collectionId: null }
    ]
  };
  assert.deepEqual(deleteBookmarks(state, ['b2']).bookmarks.map(({ id }) => id), ['b1']);
});

test('SCN-010 storage persists saved data and sanitizes invalid data', () => {
  const memory = new Map();
  const storage = {
    getItem: (key) => memory.get(key) ?? null,
    setItem: (key, value) => memory.set(key, value)
  };
  const state = {
    collections: [{ id: 'c1', name: 'Web' }],
    bookmarks: [{ id: 'b1', name: 'MDN', url: 'https://developer.mozilla.org', collectionId: 'c1' }]
  };
  saveState(state, storage);
  assert.equal(memory.has(STORAGE_KEY), true);
  assert.deepEqual(loadState(storage), state);
  assert.deepEqual(sanitizeState({ bookmarks: 'bad', collections: [] }), empty());
});
