import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeDb } from './helpers.js';
import {
  createBookmark,
  updateBookmark,
  applyFetchedMetadata,
  getRow,
} from '../src/models/bookmark.js';

test('delayed metadata fills fields the user has NOT customized', (t) => {
  const db = makeDb(t);
  const { row } = createBookmark(db, { url: 'https://example.com/a' });
  // No user title/description yet -> a later fetch should populate both.
  applyFetchedMetadata(db, row.id, {
    title: 'Fetched Title',
    description: 'Fetched description',
    status: 'complete',
  });
  const after = getRow(db, row.id);
  assert.equal(after.title, 'Fetched Title');
  assert.equal(after.description, 'Fetched description');
  assert.equal(after.metadata_status, 'complete');
});

test('delayed metadata NEVER overwrites a title the user entered while pending', (t) => {
  const db = makeDb(t);
  const { row } = createBookmark(db, { url: 'https://example.com/b' });
  // User edits the title while metadata is still 'pending' (the race).
  updateBookmark(db, row.id, { title: 'My Own Title' });
  // Fetch resolves AFTER the edit.
  applyFetchedMetadata(db, row.id, {
    title: 'Fetched Title',
    description: 'Fetched description',
    status: 'complete',
  });
  const after = getRow(db, row.id);
  assert.equal(after.title, 'My Own Title', 'user title must survive a late fetch');
  // Description was not user-set, so it fills.
  assert.equal(after.description, 'Fetched description');
});

test('title supplied at save time is protected from later fetch', (t) => {
  const db = makeDb(t);
  const { row } = createBookmark(db, {
    url: 'https://example.com/c',
    title: 'Saved Title',
    description: 'Saved description',
  });
  applyFetchedMetadata(db, row.id, {
    title: 'Fetched Title',
    description: 'Fetched description',
    status: 'complete',
  });
  const after = getRow(db, row.id);
  assert.equal(after.title, 'Saved Title');
  assert.equal(after.description, 'Saved description');
});
