import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { useTempData } from '../helpers/seed.js';

let svc;
let conn;
let temp;

before(async () => {
  temp = useTempData();
  svc = await import('../../src/server/services/bookmarks.js');
  conn = await import('../../src/server/db/connection.js');
});
after(() => temp.cleanup());

test('bookmarks, tags, states and preferences survive a database reopen', async () => {
  const prefs = await import('../../src/server/services/preferences.js');
  const b = svc.createBookmark({ address: 'https://persist.example/', title: 'Persist', tags: ['keepme'] });
  await import('../../src/server/services/bookmarks.js').then((m) => m.updateBookmark(b.id, { isArchived: true }));
  prefs.updatePreferences({ textSize: 'large' });

  // Simulate a restart: close and reopen the database (same file).
  conn.closeDb();
  conn.getDb();

  const again = svc.getBookmark(b.id);
  assert.equal(again.title, 'Persist');
  assert.deepEqual(again.tags, ['keepme']);
  assert.equal(again.isArchived, true);
  assert.equal(prefs.getPreferences().textSize, 'large');
});
