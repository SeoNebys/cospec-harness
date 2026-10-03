import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createStore } from '../src/store.js';
import { insertBookmark } from './test-helpers.js';

test('the complete organized library survives closing and reopening its database', (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'keepwell-persistence-'));
  const filename = path.join(directory, 'library.sqlite');
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));

  let store = createStore(filename);
  const everyday = insertBookmark(store, { sequence: 'persistent', title: 'Original title', content_html: '<article><p>Frozen article body</p></article>' });
  store.updateDetails(everyday.id, { title: 'Edited title', description: 'Edited detail' });
  store.setTags(everyday.id, ['science', 'animals']);
  store.setReadLater(everyday.id, true);
  const archived = insertBookmark(store, { sequence: 'archived', title: 'Archived title' });
  store.archive(archived.id);
  store.createSavedView({ name: 'Animal minds', query: 'Edited', tag: 'animals', sort: 'oldest' });
  store.close();

  store = createStore(filename);
  const reloaded = store.getBookmark(everyday.id);
  assert.equal(reloaded.title, 'Edited title');
  assert.equal(reloaded.description, 'Edited detail');
  assert.deepEqual(reloaded.tags, ['animals', 'science']);
  assert.equal(reloaded.read_later, true);
  assert.match(reloaded.content_html, /Frozen article body/);
  assert.equal(store.getBookmark(archived.id).archived, true);
  assert.deepEqual(store.getNavigation().savedViews.map(({ name }) => name), ['Animal minds']);
  store.close();
});
