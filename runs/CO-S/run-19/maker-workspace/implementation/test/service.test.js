import assert from 'node:assert/strict';
import test from 'node:test';
import { createService, DuplicateError } from '../src/service.js';
import { insertBookmark, temporaryStore } from './test-helpers.js';

test('manual fallback saves recognizable details but honestly records no page copy', (t) => {
  const store = temporaryStore(t);
  const service = createService(store);
  const saved = service.saveManual({ url: 'https://locked.example/article', title: 'Private notes', description: 'Needs sign-in' });
  assert.equal(saved.title, 'Private notes');
  assert.equal(saved.description, 'Needs sign-in');
  assert.equal(saved.capture_status, 'none');
  assert.equal(saved.content_html, '');
});

test('duplicate prevention ignores tracking and preserves original details and saved date', (t) => {
  const store = temporaryStore(t);
  const service = createService(store);
  const original = service.saveManual({ url: 'https://example.com/story?part=1', title: 'Original title', description: 'Original detail' });
  assert.throws(
    () => service.saveManual({ url: 'https://example.com/story?utm_source=mail&part=1#top', title: 'Replacement', description: '' }),
    (error) => {
      assert.ok(error instanceof DuplicateError);
      assert.equal(error.bookmark.id, original.id);
      assert.equal(error.bookmark.title, 'Original title');
      assert.equal(error.bookmark.created_at, original.created_at);
      return true;
    },
  );
  assert.equal(store.listBookmarks().total, 1);
});

test('editing requires a title, allows an empty description, and leaves unrelated details intact', (t) => {
  const store = temporaryStore(t);
  const original = insertBookmark(store, { sequence: 'edit', title: 'Old title', description: 'Old description' });
  assert.throws(() => store.updateDetails(original.id, { title: '', description: 'Changed' }), /title/i);
  assert.equal(store.getBookmark(original.id).description, 'Old description');
  const updated = store.updateDetails(original.id, { title: 'Octopus intelligence', description: '' });
  assert.equal(updated.title, 'Octopus intelligence');
  assert.equal(updated.description, '');
  assert.equal(updated.url, original.url);
  assert.equal(updated.captured_at, original.captured_at);
});

test('read later, archive, and restore maintain the approved lifecycle', (t) => {
  const store = temporaryStore(t);
  const bookmark = insertBookmark(store, { sequence: 'lifecycle' });
  store.setReadLater(bookmark.id, true);
  assert.equal(store.listBookmarks({ section: 'later' }).total, 1);
  store.archive(bookmark.id);
  assert.equal(store.listBookmarks({ section: 'all' }).total, 0);
  assert.equal(store.listBookmarks({ section: 'later' }).total, 0);
  assert.equal(store.listBookmarks({ section: 'archive' }).total, 1);
  const restored = store.restore(bookmark.id);
  assert.equal(restored.archived, false);
  assert.equal(restored.read_later, false);
  assert.equal(store.listBookmarks({ section: 'all' }).total, 1);
});

test('permanent deletion removes the bookmark instead of moving it to Archive', (t) => {
  const store = temporaryStore(t);
  const bookmark = insertBookmark(store, { sequence: 'delete' });
  store.setTags(bookmark.id, ['temporary']);
  const removed = store.deleteBookmark(bookmark.id);
  assert.equal(removed.id, bookmark.id);
  assert.equal(store.getBookmark(bookmark.id), null);
  assert.equal(store.listBookmarks({ section: 'archive' }).total, 0);
  assert.equal(store.getNavigation().tags.length, 0);
});
