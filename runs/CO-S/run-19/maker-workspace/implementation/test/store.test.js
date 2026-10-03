import assert from 'node:assert/strict';
import test from 'node:test';
import { insertBookmark, temporaryStore } from './test-helpers.js';

test('search uses case-insensitive partial text across title, description, and website', (t) => {
  const store = temporaryStore(t);
  insertBookmark(store, { sequence: 'octopus', title: 'The surprising intelligence of octopuses', description: 'Underwater puzzles', source_host: 'science.example' });
  insertBookmark(store, { sequence: 'bread', title: 'Sourdough guide', description: 'Fermentation basics', source_host: 'kitchen.example' });
  assert.equal(store.listBookmarks({ query: 'OCTOPUS' }).items[0].title, 'The surprising intelligence of octopuses');
  assert.equal(store.listBookmarks({ query: 'water puzz' }).total, 1);
  assert.equal(store.listBookmarks({ query: 'science.exam' }).total, 1);
  assert.equal(store.listBookmarks({ query: 'missing' }).total, 0);
  assert.equal(store.listBookmarks().total, 2);
});

test('tags can be combined, suggested with counts, filtered, and cleaned up when unused', (t) => {
  const store = temporaryStore(t);
  const first = insertBookmark(store, { sequence: 'one', title: 'One' });
  const second = insertBookmark(store, { sequence: 'two', title: 'Two' });
  store.setTags(first.id, ['Science', 'animals']);
  store.setTags(second.id, ['animals']);
  assert.deepEqual(store.getBookmark(first.id).tags, ['animals', 'science']);
  assert.deepEqual(store.suggestTags('ani', ['science']), [{ name: 'animals', count: 2 }]);
  assert.equal(store.listBookmarks({ tag: 'animals' }).total, 2);
  const before = store.getBookmark(first.id);
  store.setTags(first.id, []);
  const after = store.getBookmark(first.id);
  assert.deepEqual(after.tags, []);
  assert.equal(after.title, before.title);
  assert.equal(after.preview_image, before.preview_image);
  store.setTags(second.id, []);
  assert.equal(store.getNavigation().tags.some((tag) => tag.name === 'animals'), false);
});

test('filter and every approved sort order work together', (t) => {
  const store = temporaryStore(t);
  const zebra = insertBookmark(store, { sequence: 'zebra', title: 'Zebra', created_at: '2024-01-03T00:00:00.000Z' });
  const ant = insertBookmark(store, { sequence: 'ant', title: 'Ant', created_at: '2024-01-01T00:00:00.000Z' });
  insertBookmark(store, { sequence: 'middle', title: 'Middle', created_at: '2024-01-02T00:00:00.000Z' });
  store.setTags(zebra.id, ['animals']);
  store.setTags(ant.id, ['animals']);
  assert.deepEqual(store.listBookmarks({ tag: 'animals', sort: 'newest' }).items.map(({ title }) => title), ['Zebra', 'Ant']);
  assert.deepEqual(store.listBookmarks({ tag: 'animals', sort: 'oldest' }).items.map(({ title }) => title), ['Ant', 'Zebra']);
  assert.deepEqual(store.listBookmarks({ tag: 'animals', sort: 'az' }).items.map(({ title }) => title), ['Ant', 'Zebra']);
  assert.deepEqual(store.listBookmarks({ tag: 'animals', sort: 'za' }).items.map(({ title }) => title), ['Zebra', 'Ant']);
});

test('pagination handles hundreds of items in groups of eight with a correct visible slice', (t) => {
  const store = temporaryStore(t);
  for (let index = 1; index <= 347; index += 1) {
    insertBookmark(store, { sequence: String(index), title: `Bookmark ${String(index).padStart(3, '0')}`, created_at: new Date(Date.UTC(2024, 0, index)).toISOString() });
  }
  const page = store.listBookmarks({ sort: 'oldest', page: 2, perPage: 8 });
  assert.equal(page.total, 347);
  assert.equal(page.totalPages, 44);
  assert.equal(page.page, 2);
  assert.equal(page.items.length, 8);
  assert.equal(page.items[0].title, 'Bookmark 009');
  assert.equal(page.items[7].title, 'Bookmark 016');
});

test('saved views preserve query, tag, and sort and reject empty names', (t) => {
  const store = temporaryStore(t);
  const view = store.createSavedView({ name: 'Animal minds', query: 'puzzles', tag: 'Animals', sort: 'oldest' });
  assert.deepEqual({ name: view.name, query: view.query, tag: view.tag, sort: view.sort }, {
    name: 'Animal minds', query: 'puzzles', tag: 'animals', sort: 'oldest',
  });
  assert.throws(() => store.createSavedView({ name: '   ', query: 'kept', tag: 'animals', sort: 'oldest' }), /name/);
  assert.equal(store.getNavigation().savedViews.length, 1);
});
