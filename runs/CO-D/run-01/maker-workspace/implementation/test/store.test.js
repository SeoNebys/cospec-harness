import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Store } from '../src/core/store.js';

function fixedStore() {
  return new Store({ now: () => '2026-07-12' });
}

// SCN-001: saving stores a new link on top with the day's date.
test('save adds a new link at the top', () => {
  const s = fixedStore();
  const a = s.save('example.com/a');
  const b = s.save('example.com/b');
  assert.equal(a.status, 'added');
  assert.equal(b.status, 'added');
  assert.equal(s.bookmarks[0].id, b.bookmark.id); // newest on top
  assert.equal(a.bookmark.savedAt, '2026-07-12');
  assert.equal(a.bookmark.url, 'https://example.com/a');
});

// Edge: non-links are refused, nothing stored.
test('save refuses a non-link', () => {
  const s = fixedStore();
  const r = s.save('grocery list');
  assert.equal(r.status, 'invalid');
  assert.equal(s.bookmarks.length, 0);
});

// SCN-004: re-saving the same page makes NO copy; returns the existing one.
test('save detects a duplicate and makes no copy', () => {
  const s = fixedStore();
  const first = s.save('https://en.wikipedia.org/wiki/Ancient_Rome');
  const again = s.save('https://www.en.wikipedia.org/wiki/Ancient_Rome/'); // www + slash
  assert.equal(again.status, 'duplicate');
  assert.equal(again.bookmark.id, first.bookmark.id);
  assert.equal(s.bookmarks.length, 1);
});

// SCN-012: delete removes the link (and its saved copy, by definition).
test('remove deletes a link', () => {
  const s = fixedStore();
  const { bookmark } = s.save('example.com/x');
  assert.equal(s.remove(bookmark.id), true);
  assert.equal(s.bookmarks.length, 0);
});

// SCN-016: bulk delete.
test('removeMany deletes a batch and counts them', () => {
  const s = fixedStore();
  const ids = ['a', 'b', 'c'].map((p) => s.save('example.com/' + p).bookmark.id);
  const n = s.removeMany([ids[0], ids[2]]);
  assert.equal(n, 2);
  assert.equal(s.bookmarks.length, 1);
});
