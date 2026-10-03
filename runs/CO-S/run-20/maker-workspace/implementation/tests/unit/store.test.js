import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';
import { BookmarkStore, ValidationError } from '../../src/store.js';

let file;
let store;
beforeEach(() => {
  file = join(tmpdir(), `bm-test-${process.pid}-${Math.random().toString(36).slice(2)}.json`);
  try { rmSync(file); } catch {}
  store = new BookmarkStore(file);
});

test('create adds a link, defaults to unread and not archived (SCN-001/SCN-004)', () => {
  const { item, duplicate } = store.create({ url: 'https://a.com/x', title: 'A', topics: ['T'] });
  assert.equal(duplicate, false);
  assert.equal(item.unread, true);
  assert.equal(item.archived, false);
  assert.equal(item.host, 'a.com');
  assert.deepEqual(store.list().length, 1);
});

test('create requires an address (SCN-006)', () => {
  assert.throws(() => store.create({ url: '   ' }), ValidationError);
});

test('blank title falls back to host (SCN-006)', () => {
  const { item } = store.create({ url: 'https://www.site.com/page', title: '' });
  assert.equal(item.title, 'site.com');
});

test('create refuses duplicates across collection and archive (SCN-009)', () => {
  const first = store.create({ url: 'https://dup.com/a', title: 'One' }).item;
  store.setArchived(first.id, true);
  const again = store.create({ url: 'HTTPS://dup.com/a/', title: 'Two' });
  assert.equal(again.duplicate, true);
  assert.equal(again.item.id, first.id);
  assert.equal(store.list().length, 1);
});

test('update edits fields but preserves created/unread/archived (SCN-008)', () => {
  const item = store.create({ url: 'https://a.com/x', title: 'A' }).item;
  store.setUnread(item.id, false);
  const created = item.created;
  const res = store.update(item.id, { title: 'B', note: 'hello', topics: ['X', 'x', 'Y'] });
  assert.equal(res.item.title, 'B');
  assert.equal(res.item.note, 'hello');
  assert.deepEqual(res.item.topics, ['X', 'Y']); // de-duplicated case-insensitively
  assert.equal(res.item.unread, false);
  assert.equal(res.item.archived, false);
  assert.equal(res.item.created, created);
});

test('update rejects an address used by another link (SCN-009)', () => {
  const a = store.create({ url: 'https://a.com/1', title: 'A' }).item;
  const b = store.create({ url: 'https://b.com/2', title: 'B' }).item;
  const res = store.update(b.id, { url: 'https://a.com/1/' });
  assert.equal(res.conflict, true);
  assert.equal(res.item.id, a.id);
});

test('remove deletes permanently (SCN-008)', () => {
  const item = store.create({ url: 'https://a.com/x', title: 'A' }).item;
  assert.equal(store.remove(item.id), true);
  assert.equal(store.get(item.id), null);
  assert.equal(store.remove(9999), false);
});

test('archive and read toggles persist (SCN-004/SCN-005)', () => {
  const item = store.create({ url: 'https://a.com/x', title: 'A' }).item;
  store.setArchived(item.id, true);
  store.setUnread(item.id, false);
  const reloaded = new BookmarkStore(file);
  const same = reloaded.get(item.id);
  assert.equal(same.archived, true);
  assert.equal(same.unread, false);
});
