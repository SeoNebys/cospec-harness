import test from 'node:test';
import assert from 'node:assert/strict';
import { BookmarkStore } from '../lib/database.js';

function sample(overrides = {}) {
  return {
    url: 'https://example.com/article',
    siteName: 'Example',
    title: 'A useful article',
    description: 'Notes about fluffy potatoes and careful testing.',
    faviconUrl: null,
    labels: ['Work'],
    readLater: false,
    ...overrides
  };
}

test('one stored record supports search, labels, reading state, and archive state together', () => {
  const store = new BookmarkStore(':memory:');
  try {
    const first = store.create(sample());
    store.bulkAddLabel([first.id], 'Recipes');
    store.bulkAddLabel([first.id], 'recipes');
    store.bulkReadLater([first.id]);

    const found = store.list({ view: 'later', search: 'FLUFFY', label: 'recipes' });
    assert.equal(found.length, 1);
    assert.deepEqual(found[0].labels, ['Recipes', 'Work']);
    assert.equal(found[0].readLater, true);

    store.update(first.id, { archived: true });
    assert.equal(store.list({ view: 'active', search: 'fluffy' }).length, 0);
    assert.equal(store.list({ view: 'later' }).length, 0);
    const archived = store.list({ view: 'archived' });
    assert.equal(archived.length, 1);
    assert.equal(archived[0].readLater, true);
    assert.deepEqual(archived[0].labels, ['Recipes', 'Work']);

    store.update(first.id, { archived: false });
    assert.equal(store.list({ view: 'later' }).length, 1);
  } finally {
    store.close();
  }
});

test('tracking and section variants find the existing bookmark while meaningful queries stay separate', () => {
  const store = new BookmarkStore(':memory:');
  try {
    const saved = store.create(sample({ url: 'https://example.com/article' }));
    assert.equal(store.findByUrl('https://example.com/article?utm_source=email#method').id, saved.id);
    assert.equal(store.findByUrl('https://example.com/article?edition=print'), null);
  } finally {
    store.close();
  }
});

test('search includes title, description, site name, and original address', () => {
  const store = new BookmarkStore(':memory:');
  try {
    store.create(sample({
      url: 'https://research.example.com/special-address-token',
      siteName: 'Needle Research Journal',
      title: 'Distinctive title wording',
      description: 'Memorable description wording'
    }));
    for (const query of ['distinctive title', 'memorable description', 'needle research', 'special-address-token']) {
      assert.equal(store.list({ view: 'active', search: query }).length, 1, query);
    }
  } finally {
    store.close();
  }
});

test('bulk labels add without replacing existing labels and bulk delete is exact', () => {
  const store = new BookmarkStore(':memory:');
  try {
    const first = store.create(sample({ url: 'https://example.com/one', labels: ['Recipes'] }));
    const second = store.create(sample({ url: 'https://example.com/two', labels: ['Travel'] }));
    store.bulkAddLabel([first.id, second.id], 'Work');
    assert.deepEqual(store.get(first.id).labels, ['Recipes', 'Work']);
    assert.deepEqual(store.get(second.id).labels, ['Travel', 'Work']);
    assert.equal(store.bulkDelete([first.id]), 1);
    assert.equal(store.get(first.id), null);
    assert.notEqual(store.get(second.id), null);
  } finally {
    store.close();
  }
});

test('search and filters remain correct across a collection of hundreds', () => {
  const store = new BookmarkStore(':memory:');
  try {
    for (let index = 0; index < 240; index += 1) {
      store.create(sample({
        url: `https://example.com/items/${index}`,
        title: index === 173 ? 'The one needle page' : `Saved page ${index}`,
        description: `Collection entry number ${index}`,
        labels: [index % 2 ? 'Work' : 'Recipes'],
        readLater: index % 5 === 0
      }));
    }
    assert.equal(store.list({ view: 'active' }).length, 240);
    assert.equal(store.list({ view: 'active', search: 'NEEDLE', label: 'work' }).length, 1);
    assert.equal(store.list({ view: 'later', label: 'Recipes' }).length, 24);
  } finally {
    store.close();
  }
});
