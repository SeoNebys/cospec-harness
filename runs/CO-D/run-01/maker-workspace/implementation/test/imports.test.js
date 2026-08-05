import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Store } from '../src/core/store.js';
import { parseImport, importText, exportText } from '../src/core/imports.js';

function fixedStore() {
  return new Store({ now: () => '2026-07-12' });
}

const SAMPLE = [
  'Ancient Rome - Wikipedia | https://en.wikipedia.org/wiki/Ancient_Rome | History | 2020-01-14',
  'Best Pizza Dough | https://cooking.example.com/pizza | Recipes/Italian | 2019-08-03',
  'Kyoto Itinerary | https://travel.example.com/kyoto | Travel/Japan | 2018-05-22',
  'No Date Link | https://ex.com/nodate | Misc',
  'broken line with no url',
].join('\n');

test('parseImport reads title | url | folder | date', () => {
  const entries = parseImport(SAMPLE);
  assert.equal(entries.length, 5);
  assert.deepEqual(entries[0], {
    title: 'Ancient Rome - Wikipedia',
    url: 'https://en.wikipedia.org/wiki/Ancient_Rome',
    folder: 'History',
    date: '2020-01-14',
  });
});

// SCN-013: folders -> split labels; dedup at import; malformed rows skipped.
test('import brings the pile in, folders become split labels', () => {
  const s = fixedStore();
  const res = importText(s, SAMPLE);
  assert.equal(res.added, 4);
  assert.equal(res.skippedInvalid, 1); // the broken line

  const kyoto = s.bookmarks.find((b) => b.url.includes('kyoto'));
  assert.deepEqual(kyoto.labels, ['travel', 'japan']); // split, not "travel/japan"
});

// SCN-013 + build-priorities: duplicates skipped at the front door.
test('import skips links already saved', () => {
  const s = fixedStore();
  s.save('https://en.wikipedia.org/wiki/Ancient_Rome'); // already have it
  const res = importText(s, SAMPLE);
  assert.equal(res.skippedDuplicate, 1);
  const romes = s.bookmarks.filter((b) => b.url.includes('Ancient_Rome'));
  assert.equal(romes.length, 1); // no second copy
});

// SCN-013: ORIGINAL dates preserved; missing date falls back to import date.
test('import preserves original dates, falls back only when absent', () => {
  const s = fixedStore();
  importText(s, SAMPLE);
  const kyoto = s.bookmarks.find((b) => b.url.includes('kyoto'));
  const noDate = s.bookmarks.find((b) => b.url.includes('nodate'));
  assert.equal(kyoto.savedAt, '2018-05-22'); // real age kept
  assert.equal(noDate.savedAt, '2026-07-12'); // fell back to today
});

test('import is robust to a messy pile (does not throw, counts outcomes)', () => {
  const s = fixedStore();
  const messy = [
    'Good | https://good.com/x | A/B | 2021-01-01',
    '',
    '   ',
    'Title only, no url',
    'Bad url | not a url | Folder',
    'Weird date | https://ex.com/wd | Misc | 99-99',
  ].join('\n');
  const res = importText(s, messy);
  assert.equal(res.added, 2); // good.com + ex.com/wd
  assert.equal(res.skippedInvalid, 2); // "no url" and "not a url"
  const wd = s.bookmarks.find((b) => b.url.includes('/wd'));
  assert.equal(wd.savedAt, '2026-07-12'); // invalid date -> today
});

// SCN-014: export is plain and portable, round-trips back through import.
test('export produces portable text that re-imports', () => {
  const s = fixedStore();
  importText(s, SAMPLE);
  const text = exportText(s.bookmarks);
  const s2 = fixedStore();
  const res = importText(s2, text);
  assert.equal(res.added, 4);
  assert.equal(s2.bookmarks.length, 4);
});
