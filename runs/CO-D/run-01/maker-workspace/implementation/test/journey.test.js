// End-to-end journey through the real store + core, mirroring what the UI does
// (minus the DOM). Proves the composition the app relies on, across scenarios.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Store } from '../src/core/store.js';
import { addLabel, allLabels, removeLabel } from '../src/core/labels.js';
import { search } from '../src/core/search.js';
import { sortBookmarks } from '../src/core/sort.js';
import { importText, exportText } from '../src/core/imports.js';
import { clickOpens } from '../src/core/copy.js';

test('full journey: save → dedupe → import → find → organize → read-later → bulk → delete → export', () => {
  const store = new Store({ now: () => '2026-07-12' });

  // Save (SCN-001) and set metadata as the page service would.
  const rome = store.save('en.wikipedia.org/wiki/Ancient_Rome').bookmark;
  rome.title = 'Ancient Rome - Wikipedia';
  rome.summary = 'A civilization that became an empire ruling the Mediterranean.';
  rome.copy = { kind: 'text', dead: false };

  // Duplicate (SCN-004): same page, www + trailing slash → no copy.
  const again = store.save('https://www.en.wikipedia.org/wiki/Ancient_Rome/');
  assert.equal(again.status, 'duplicate');
  assert.equal(store.bookmarks.length, 1);

  // Import a messy pile (SCN-013): dedupe, folders → labels, dates preserved.
  const res = importText(store, [
    'Ancient Rome - Wikipedia | https://en.wikipedia.org/wiki/Ancient_Rome | History | 2020-01-01', // dup
    'Carbonara | https://cooking.example.com/carbonara | Recipes/Italian | 2019-05-05',
    'Kyoto | https://travel.example.com/kyoto | Travel/Japan | 2018-05-22',
    'garbage line',
  ].join('\n'));
  assert.equal(res.added, 2);
  assert.equal(res.skippedDuplicate, 1);
  assert.equal(res.skippedInvalid, 1);
  assert.equal(store.bookmarks.length, 3);

  // Find (SCN-005/011): note is searchable; word variation works.
  const carbonara = store.bookmarks.find((b) => b.url.includes('carbonara'));
  carbonara.note = 'Mum loved this one.';
  assert.equal(search(store.bookmarks, 'mum').length, 1);
  assert.equal(search(store.bookmarks, 'Rome').some((b) => b.title.includes('Ancient Rome')), true);

  // Organize (SCN-006): reuse discipline — "Italian" reuses imported "italian".
  addLabel(carbonara, allLabels(store.bookmarks), 'Italian');
  assert.deepEqual(carbonara.labels, ['recipes', 'italian']); // no case-variant twin

  // Sorting (SCN-015): oldest surfaces the 2018 import.
  const oldest = sortBookmarks(store.bookmarks, 'oldest')[0];
  assert.ok(oldest.url.includes('kyoto'));

  // Read-later (SCN-008): flag, then clear, stays saved.
  const kyoto = store.bookmarks.find((b) => b.url.includes('kyoto'));
  kyoto.toRead = true;
  assert.equal(store.bookmarks.filter((b) => b.toRead).length, 1);
  kyoto.toRead = false;
  assert.equal(store.bookmarks.length, 3); // still saved

  // Bulk (SCN-016): label a batch, then remove it from all.
  const ids = store.bookmarks.map((b) => b.id);
  ids.forEach((id) => addLabel(store.get(id), allLabels(store.bookmarks), 'archive'));
  assert.equal(store.bookmarks.every((b) => b.labels.includes('archive')), true);
  ids.forEach((id) => removeLabel(store.get(id), 'archive'));
  assert.equal(store.bookmarks.some((b) => b.labels.includes('archive')), false);

  // Copy honesty (SCN-009): a live text copy opens the original.
  assert.equal(clickOpens(rome), 'original');

  // Delete (SCN-012) then export round-trips (SCN-014).
  store.remove(kyoto.id);
  assert.equal(store.bookmarks.length, 2);
  const store2 = new Store({ now: () => '2026-07-12' });
  const re = importText(store2, exportText(store.bookmarks));
  assert.equal(re.added, 2);
});
