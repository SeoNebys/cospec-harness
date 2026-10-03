'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { Store } = require('../../src/store.js');

function tmpStore() {
  const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'bm-')), 'data.json');
  return new Store(f);
}

test('create then duplicate returns existing (SCN-002)', () => {
  const s = tmpStore();
  const a = s.create({ url: 'https://www.example.com/', title: 'Ex' });
  assert.strictEqual(a.duplicate, false);
  const b = s.create({ url: 'http://example.com', title: 'Other' });
  assert.strictEqual(b.duplicate, true);
  assert.strictEqual(b.bookmark.id, a.bookmark.id);
  assert.strictEqual(s.all().length, 1);
});

test('new entry starts unread & active, no tags (SCN-003, SCN-004)', () => {
  const s = tmpStore();
  const { bookmark } = s.create({ url: 'a.test', title: 'A' });
  assert.strictEqual(bookmark.read, false);
  assert.strictEqual(bookmark.archived, false);
  assert.deepStrictEqual(bookmark.tags, []);
});

test('invalid url rejected (SCN-013)', () => {
  const s = tmpStore();
  assert.strictEqual(s.create({ url: 'not a url @@' }).error, 'invalid_url');
});

test('edit address guards duplicates and validates (SCN-006)', () => {
  const s = tmpStore();
  const a = s.create({ url: 'a.test', title: 'A' }).bookmark;
  const b = s.create({ url: 'b.test', title: 'B' }).bookmark;
  assert.strictEqual(s.update(b.id, { url: 'a.test' }).error, 'duplicate_address');
  assert.strictEqual(s.update(b.id, { url: 'nonsense @@' }).error, 'invalid_url');
  const ok = s.update(b.id, { url: 'c.test' });
  assert.strictEqual(ok.bookmark.url, 'https://c.test/');
});

test('clearing title falls back to site name (SCN-006)', () => {
  const s = tmpStore();
  const a = s.create({ url: 'https://foo.test/page', title: 'Title' }).bookmark;
  const r = s.update(a.id, { title: '   ' });
  assert.strictEqual(r.bookmark.title, 'foo.test');
});

test('read/archive independent; restore preserves read (SCN-003)', () => {
  const s = tmpStore();
  const a = s.create({ url: 'a.test' }).bookmark;
  s.setState(a.id, { read: true });
  s.setState(a.id, { archived: true });
  assert.strictEqual(s.byId(a.id).read, true);
  s.setState(a.id, { archived: false });
  assert.strictEqual(s.byId(a.id).read, true); // preserved
});

test('tags add is case-insensitive dedup; remove works (SCN-004)', () => {
  const s = tmpStore();
  const a = s.create({ url: 'a.test' }).bookmark;
  s.addTag(a.id, 'Reference'); s.addTag(a.id, 'reference');
  assert.deepStrictEqual(s.byId(a.id).tags, ['Reference']);
  s.removeTag(a.id, 'REFERENCE');
  assert.deepStrictEqual(s.byId(a.id).tags, []);
});

test('bulk actions and permanent delete (SCN-014, SCN-015)', () => {
  const s = tmpStore();
  const a = s.create({ url: 'a.test' }).bookmark;
  const b = s.create({ url: 'b.test' }).bookmark;
  s.bulk([a.id, b.id], 'read');
  assert.ok(s.byId(a.id).read && s.byId(b.id).read);
  s.bulk([a.id, b.id], 'addtag', 'batch');
  assert.ok(s.byId(a.id).tags.indexOf('batch') >= 0);
  s.remove(a.id);
  assert.strictEqual(s.byId(a.id), undefined);
  s.bulk([b.id], 'delete');
  assert.strictEqual(s.all().length, 0);
});

test('persistence across reload (dependable library)', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bm-'));
  const f = path.join(dir, 'data.json');
  const s1 = new Store(f);
  s1.create({ url: 'a.test', title: 'Persisted' });
  const s2 = new Store(f);
  assert.strictEqual(s2.all().length, 1);
  assert.strictEqual(s2.all()[0].title, 'Persisted');
});
