import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase } from '../../server/db.js';
import { createRepository, DuplicateUrlError, NotFoundError } from '../../server/bookmarks.repo.js';

// A title fetcher stub so tests never hit the network.
const noFetch = async () => null;

function repo(t) {
  const db = openDatabase(':memory:');
  // Close the native handle when the test finishes to avoid a better-sqlite3
  // destructor crash during worker teardown.
  t.after(() => db.close());
  return createRepository(db, { titleFetcher: noFetch });
}

test('create derives title from URL when none provided and fetch fails', async (t) => {
  const r = repo(t);
  const b = await r.create({ url: 'https://example.com' });
  assert.equal(b.url, 'https://example.com/');
  assert.equal(b.title, 'https://example.com/');
  assert.deepEqual(b.tags, []);
});

test('create uses custom title and normalizes tags', async (t) => {
  const r = repo(t);
  const b = await r.create({ url: 'https://a.com', title: 'My Site', tags: ['Tech', 'tech', ' Reading '] });
  assert.equal(b.title, 'My Site');
  assert.deepEqual(b.tags.sort(), ['reading', 'tech']);
});

test('create rejects duplicate normalized URL', async (t) => {
  const r = repo(t);
  await r.create({ url: 'https://dup.com' });
  await assert.rejects(() => r.create({ url: 'https://dup.com:443' }), DuplicateUrlError);
});

test('list returns newest first', async (t) => {
  const r = repo(t);
  await r.create({ url: 'https://one.com', title: 'one' });
  await r.create({ url: 'https://two.com', title: 'two' });
  const list = r.list();
  assert.equal(list[0].title, 'two');
  assert.equal(list[1].title, 'one');
});

test('list filters by keyword across title, url, and tags', async (t) => {
  const r = repo(t);
  await r.create({ url: 'https://alpha.com', title: 'Alpha', tags: ['news'] });
  await r.create({ url: 'https://beta.com', title: 'Beta', tags: ['tech'] });
  assert.equal(r.list({ q: 'alpha' }).length, 1);
  assert.equal(r.list({ q: 'tech' }).length, 1);
  assert.equal(r.list({ q: 'beta.com' })[0].title, 'Beta');
  assert.equal(r.list({ q: 'zzz' }).length, 0);
});

test('list filters by tag', async (t) => {
  const r = repo(t);
  await r.create({ url: 'https://a.com', tags: ['x'] });
  await r.create({ url: 'https://b.com', tags: ['x'] });
  await r.create({ url: 'https://c.com', tags: ['y'] });
  assert.equal(r.list({ tags: ['x'] }).length, 2);
});

test('update changes title and rejects duplicate url', async (t) => {
  const r = repo(t);
  const a = await r.create({ url: 'https://a.com', title: 'A' });
  await r.create({ url: 'https://b.com', title: 'B' });
  const updated = await r.update(a.id, { title: 'A2' });
  assert.equal(updated.title, 'A2');
  await assert.rejects(() => r.update(a.id, { url: 'https://b.com' }), DuplicateUrlError);
});

test('remove deletes and prunes; missing id throws NotFound', async (t) => {
  const r = repo(t);
  const a = await r.create({ url: 'https://a.com', tags: ['solo'] });
  assert.equal(r.remove(a.id), true);
  assert.equal(r.list().length, 0);
  assert.equal(r.listTags().length, 0);
  assert.throws(() => r.remove(999), NotFoundError);
});
