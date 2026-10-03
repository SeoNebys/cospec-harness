const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { Store } = require('../../lib/store');

function tmpStore() { return new Store(path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'bm-')), 'store.json')); }

// SCN-001 / SCN-011
test('create rejects invalid url', () => { const s = tmpStore(); assert.equal(s.create({ url: '' }).error, 'invalid-url'); });
test('create adds bookmark with defaults', () => {
  const s = tmpStore(); const { bookmark } = s.create({ url: 'example.com', title: 'Ex', tags: ['a', 'A', 'b'] });
  assert.equal(bookmark.url, 'https://example.com/');
  assert.deepEqual(bookmark.tags, ['a', 'b']); // deduped/lowercased
  assert.equal(bookmark.readLater, false); assert.equal(bookmark.archived, false);
  assert.ok(bookmark.favicon.fallback.letter);
});

// SCN-008 / SCN-012
test('re-saving a near-duplicate returns existing, prefers https', () => {
  const s = tmpStore(); s.create({ url: 'http://site.com/page' });
  const r = s.create({ url: 'https://site.com/page/' });
  assert.ok(r.duplicate);
  assert.equal(s.all().length, 1);
  assert.ok(r.duplicate.url.startsWith('https://')); // upgraded to secure address
});

// SCN-015
test('editing address to an existing one is refused with conflict', () => {
  const s = tmpStore(); const a = s.create({ url: 'https://a.com', title: 'A' }).bookmark;
  const b = s.create({ url: 'https://b.com', title: 'B' }).bookmark;
  const r = s.update(b.id, { url: 'https://a.com' });
  assert.equal(r.error, 'address-conflict');
  assert.equal(r.conflict.title, 'A');
  assert.equal(s.find(b.id).url, 'https://b.com/'); // unchanged
});
test('editing address to a valid unique one succeeds', () => {
  const s = tmpStore(); const b = s.create({ url: 'https://b.com', title: 'B' }).bookmark;
  const r = s.update(b.id, { url: 'https://c.com/new' });
  assert.equal(r.bookmark.url, 'https://c.com/new');
});

// SCN-013 updated time on detail edit only
test('updatedAt changes on detail edit but not on status toggle', async () => {
  const s = tmpStore(); const b = s.create({ url: 'https://a.com', title: 'A' }).bookmark;
  const t0 = b.updatedAt;
  await new Promise(r => setTimeout(r, 5));
  s.update(b.id, { readLater: true, _touch: false });
  assert.equal(s.find(b.id).updatedAt, t0); // status toggle does not touch
  s.update(b.id, { title: 'A2' });
  assert.ok(s.find(b.id).updatedAt > t0); // detail edit touches
});

// SCN-017
test('collections add/remove', () => {
  const s = tmpStore(); const { collection } = s.addCollection('Refs', '#reference NOT figma', ['css']);
  assert.equal(collection.name, 'Refs');
  assert.equal(s.getCollections().length, 1);
  s.removeCollection(collection.id);
  assert.equal(s.getCollections().length, 0);
});
