import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { BookmarkStore } from '../lib/store.js';

test('bookmark records persist across store instances', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'bookmark-store-'));
  const file = join(directory, 'bookmarks.json');
  try {
    const first = new BookmarkStore(file);
    await first.init();
    const created = await first.create({ title: 'Saved', canonicalAddress: 'example.com/' });
    const second = new BookmarkStore(file);
    await second.init();
    assert.equal((await second.findById(created.id)).title, 'Saved');
    const persisted = await readFile(file, 'utf8');
    assert.doesNotThrow(() => JSON.parse(persisted));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
