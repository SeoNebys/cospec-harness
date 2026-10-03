import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Store } from '../../src/store.js';

async function tmpFile() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'bm-store-'));
  return path.join(dir, 'data.json');
}

test('create assigns ids, keeps newest first, and persists', async () => {
  const file = await tmpFile();
  const s = await new Store(file).init();
  await s.create({ url: 'https://a.com', title: 'A' });
  await s.create({ url: 'https://b.com', title: 'B' });
  assert.equal(s.all().length, 2);
  assert.equal(s.all()[0].title, 'B'); // newest first

  // reload from disk
  const s2 = await new Store(file).init();
  assert.equal(s2.all().length, 2);
  assert.equal(s2.all()[0].title, 'B');
});

test('create defaults: title falls back to url, flags false, tags cleaned', async () => {
  const s = await new Store(await tmpFile()).init();
  const b = await s.create({ url: 'https://a.com', tags: [' x ', '', 'y'] });
  assert.equal(b.title, 'https://a.com');
  assert.deepEqual(b.tags, ['x', 'y']);
  assert.equal(b.readLater, false);
  assert.equal(b.archived, false);
});

test('update changes only allowed fields', async () => {
  const s = await new Store(await tmpFile()).init();
  const b = await s.create({ url: 'https://a.com', title: 'A' });
  const upd = await s.update(b.id, { readLater: true, note: 'later', id: 999 });
  assert.equal(upd.readLater, true);
  assert.equal(upd.note, 'later');
  assert.equal(upd.id, b.id); // id not overwritten
});

test('remove deletes and returns false for missing', async () => {
  const s = await new Store(await tmpFile()).init();
  const b = await s.create({ url: 'https://a.com' });
  assert.equal(await s.remove(b.id), true);
  assert.equal(s.all().length, 0);
  assert.equal(await s.remove(b.id), false);
});

test('reset empties the collection', async () => {
  const s = await new Store(await tmpFile()).init();
  await s.create({ url: 'https://a.com' });
  await s.reset();
  assert.equal(s.all().length, 0);
});
