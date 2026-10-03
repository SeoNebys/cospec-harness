import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { BookmarkStore, DuplicateBookmarkError } from '../../lib/store.js';

function withStore(callback) {
  const directory = mkdtempSync(join(tmpdir(), 'trove-store-'));
  const store = new BookmarkStore(join(directory, 'data.sqlite'));
  try {
    return callback(store);
  } finally {
    store.close();
    rmSync(directory, { recursive: true, force: true });
  }
}

function createRecipe(store, extra = {}) {
  return store.create({
    url: 'https://www.example.com/potatoes',
    title: 'Roast potatoes',
    description: 'Creamy centers',
    labels: ['recipes', 'Work'],
    ...extra
  });
}

test('persists bookmarks and reuses labels without case-sensitive duplicates', () => withStore(store => {
  const bookmark = createRecipe(store);
  assert.deepEqual(bookmark.labels, ['Recipes', 'Work']);
  const second = store.create({
    url: 'https://example.com/carrot',
    title: 'Carrot cake',
    labels: ['RECIPES']
  });
  assert.deepEqual(second.labels, ['Recipes']);
  assert.deepEqual(store.overview(), {
    all: 2,
    readLater: 0,
    archive: 0,
    labels: [{ name: 'Recipes', count: 2 }, { name: 'Work', count: 1 }]
  });
}));

test('prevents exact and tracking-parameter duplicates', () => withStore(store => {
  const original = createRecipe(store);
  assert.throws(() => store.create({
    url: 'https://example.com/potatoes?utm_source=email',
    title: 'Duplicate'
  }), error => {
    assert.ok(error instanceof DuplicateBookmarkError);
    assert.equal(error.bookmark.id, original.id);
    return true;
  });
  assert.equal(store.list().total, 1);
}));

test('edits addresses while preserving custom details', () => withStore(store => {
  const original = createRecipe(store);
  const updated = store.update(original.id, { url: 'https://new.example.org/moved' });
  assert.equal(updated.title, 'Roast potatoes');
  assert.equal(updated.description, 'Creamy centers');
  assert.equal(updated.siteName, 'new.example.org');
  assert.equal(updated.url, 'https://new.example.org/moved');
}));

test('scopes list, search, read-later, archive, restore, and deletion', () => withStore(store => {
  const recipe = createRecipe(store, { readLater: true });
  const guide = store.create({ url: 'https://developer.example/guide', title: 'JavaScript Guide', labels: ['Work'] });
  assert.equal(store.list({ view: 'read-later' }).total, 1);
  assert.equal(store.list({ query: 'CREAMY' }).items[0].id, recipe.id);
  assert.equal(store.list({ query: 'label:work -javascript' }).items[0].id, recipe.id);

  store.update(recipe.id, { archived: true });
  assert.equal(store.list({ view: 'all', query: 'potatoes' }).total, 0);
  assert.equal(store.list({ view: 'archive', query: 'potatoes' }).total, 1);
  store.update(recipe.id, { archived: false });
  assert.equal(store.list({ view: 'all' }).total, 2);

  assert.equal(store.delete(guide.id), true);
  assert.equal(store.get(guide.id), null);
  assert.equal(store.list({ view: 'archive' }).total, 0);
}));

test('requires a title but permits an empty description', () => withStore(store => {
  assert.throws(() => store.create({ url: 'https://example.com/a', title: '   ' }), /title/i);
  const bookmark = store.create({ url: 'https://example.com/a', title: 'Named', description: '' });
  assert.equal(bookmark.description, '');
}));

test('returns a continuous bounded slice for large collections', () => withStore(store => {
  for (let index = 1; index <= 45; index += 1) {
    store.create({ url: `https://example.com/${index}`, title: `Bookmark ${index}` });
  }
  assert.equal(store.list({ limit: 20 }).items.length, 20);
  assert.equal(store.list({ limit: 40 }).items.length, 40);
  assert.equal(store.list({ limit: 40 }).total, 45);
}));
