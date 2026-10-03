import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

process.env.BOOKMARKS_DB_PATH = ':memory:';

let server;
let base;

before(async () => {
  const { createApp } = await import('../../src/server.js');
  server = createApp().listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;

  const seed = [
    { address: 'https://alpha.com/', title: 'Alpha guide', tags: ['web'] },
    { address: 'https://beta.com/', note: 'about caching', tags: ['reading'] },
    { address: 'https://gamma.com/', title: 'Gamma', tags: ['web', 'reading'] },
  ];
  for (const b of seed) {
    await fetch(base + '/api/bookmarks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(b),
    });
  }
});

after(() => server.close());

async function list(qs = '') {
  const res = await fetch(base + '/api/bookmarks' + qs);
  return (await res.json()).bookmarks;
}

test('lists all bookmarks, newest first', async () => {
  const all = await list();
  assert.equal(all.length, 3);
  assert.equal(all[0].address, 'https://gamma.com/');
});

test('keyword search matches title', async () => {
  const r = await list('?q=Alpha');
  assert.equal(r.length, 1);
  assert.equal(r[0].address, 'https://alpha.com/');
});

test('keyword search matches note', async () => {
  const r = await list('?q=caching');
  assert.equal(r.length, 1);
  assert.equal(r[0].address, 'https://beta.com/');
});

test('keyword search matches tag', async () => {
  const r = await list('?q=reading');
  assert.equal(r.length, 2);
});

test('tag filter restricts results', async () => {
  const r = await list('?tag=web');
  assert.equal(r.length, 2);
});

test('no matches returns empty array', async () => {
  const r = await list('?q=zzzznope');
  assert.deepEqual(r, []);
});

test('tags endpoint lists tags in use', async () => {
  const res = await fetch(base + '/api/tags');
  const { tags } = await res.json();
  assert.deepEqual(tags.sort(), ['reading', 'web']);
});
