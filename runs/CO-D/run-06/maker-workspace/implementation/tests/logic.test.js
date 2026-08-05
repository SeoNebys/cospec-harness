// logic.test.js — unit + Gherkin-flavoured acceptance checks for the app's core logic.
// Runs in the browser via run.html (no build step). Pure logic only (no DOM needed).
import {
  Store, normalizeUrl, looksLikeUrl, canonicalLabel, applyFilter, sortBookmarks,
  findByUrl, matchesQuery, displayName
} from '../js/store.js';
import { parseNetscapeBookmarks, parseLinkList, summarize } from '../js/import.js';

const results = [];
function ok(name, cond) { results.push({ name, pass: !!cond }); }
function eq(name, a, b) { results.push({ name, pass: JSON.stringify(a) === JSON.stringify(b), got: a, want: b }); }

// in-memory storage so the Store doesn't touch real localStorage during tests
function memStore() { const m = {}; return new Store({ getItem: k => m[k] || null, setItem: (k, v) => { m[k] = v; } }); }

// --- SCN-014: looksLikeUrl ---
ok('sentence is not a link', !looksLikeUrl('how to cook white beans'));
ok('bare domain is a link', looksLikeUrl('smittenkitchen.com/beans'));
ok('full url is a link', looksLikeUrl('https://example.com'));
ok('single word no dot is not a link', !looksLikeUrl('recipes'));

// --- SCN-007: normalizeUrl / duplicate matching ---
eq('scheme+www+slash normalize equal',
  normalizeUrl('http://www.smittenkitchen.com/beans/'), normalizeUrl('https://smittenkitchen.com/beans'));
eq('tracking params stripped',
  normalizeUrl('https://smittenkitchen.com/beans?utm_source=nl&utm_campaign=spring'), normalizeUrl('smittenkitchen.com/beans'));
ok('different video is different',
  normalizeUrl('youtube.com/watch?v=AAA') !== normalizeUrl('youtube.com/watch?v=BBB'));
ok('meaningful query kept (value case preserved)', normalizeUrl('youtube.com/watch?v=AAA').includes('v=AAA'));

// --- SCN-002: canonical labels ---
eq('reuse existing label case-insensitively',
  canonicalLabel('Recipes', ['recipes']).canonical, 'recipes');
ok('brand new label flagged new', canonicalLabel('weeknight', ['recipes']).isNew === true);

// --- SCN-003/005/010: filtering ---
const data = [
  { id: 1, title: 'Beans', url: 'a.com', note: '', labels: ['recipes', 'dinner'], savedAt: 3 },
  { id: 2, title: 'Banana Bread', url: 'b.com', note: '', labels: ['recipes', 'baking'], savedAt: 2 },
  { id: 3, title: 'Chicken', url: 'c.com', note: 'add garlic', labels: ['recipes', 'dinner'], savedAt: 5 },
  { id: 4, title: 'Kyoto', url: 'd.com', note: '', labels: ['travel'], savedAt: 1 },
];
eq('AND narrows (recipes+dinner)', applyFilter(data, { include: ['recipes', 'dinner'], mode: 'all' }).map(b => b.id), [1, 3]);
eq('OR widens (recipes any dinner)', applyFilter(data, { include: ['baking', 'travel'], mode: 'any' }).map(b => b.id).sort(), [2, 4]);
eq('NOT excludes baking', applyFilter(data, { include: ['recipes'], exclude: ['baking'], mode: 'all' }).map(b => b.id), [1, 3]);
eq('search matches a note only', applyFilter(data, { query: 'garlic' }).map(b => b.id), [3]);
ok('matchesQuery over labels', matchesQuery(data[3], 'travel'));

// --- SCN-004: sorting ---
eq('newest first', sortBookmarks(data, 'new').map(b => b.id), [3, 1, 2, 4]);
eq('oldest first', sortBookmarks(data, 'old').map(b => b.id), [4, 2, 1, 3]);
eq('title a-z', sortBookmarks(data, 'az').map(b => b.title), ['Banana Bread', 'Beans', 'Chicken', 'Kyoto']);

// --- SCN-014: displayName falls back to host ---
eq('display name falls back to host', displayName({ title: '', url: 'https://example.com/x' }), 'example.com');

// --- Store: add + duplicate find ---
(() => {
  const s = memStore();
  s.addBookmark({ url: 'smittenkitchen.com/beans', title: 'Beans' });
  ok('new bookmark defaults to unread', s.bookmarks[0].unread === true);
  ok('duplicate found ignoring tracking',
    !!findByUrl(s.bookmarks, 'https://www.smittenkitchen.com/beans/?utm_source=x'));
  ok('non-duplicate not found', !findByUrl(s.bookmarks, 'smittenkitchen.com/other'));
})();

// --- Store: delete + undo (SCN-008) ---
(() => {
  const s = memStore();
  const b = s.addBookmark({ url: 'a.com/x', title: 'X' });
  const undo = s.deleteBookmarks([b.id]);
  ok('deleted removes it', s.bookmarks.length === 0);
  undo();
  ok('undo restores it', s.bookmarks.length === 1);
})();

// --- SCN-016: import parsing + behaviour ---
const sampleHtml = `
<!DOCTYPE NETSCAPE-Bookmark-file-1><DL><p>
  <DT><H3>Recipes</H3><DL><p>
    <DT><A HREF="https://smittenkitchen.com/beans" ADD_DATE="1600000000">Brothy Beans</A>
  </DL><p>
  <DT><H3>Read Later</H3><DL><p>
    <DT><A HREF="https://theatlantic.com/slow-reading" ADD_DATE="1610000000">Slow Reading</A>
  </DL><p>
</DL><p>`;
(() => {
  const entries = parseNetscapeBookmarks(sampleHtml);
  eq('parsed two bookmarks', entries.length, 2);
  eq('folder captured', entries[0].folder, 'Recipes');
  ok('add_date -> ms', entries[0].addedAt === 1600000000 * 1000);

  const s = memStore();
  const res = s.importBookmarks(entries, { foldersAsLabels: true, readMode: 'handled' });
  eq('imported both', res.imported, 2);
  ok('folders became labels', s.bookmarks.some(b => b.labels.includes('Recipes')));
  const beans = s.bookmarks.find(b => b.url.includes('beans'));
  const slow = s.bookmarks.find(b => b.url.includes('slow-reading'));
  ok('recipes item handled (not unread)', beans.unread === false);
  ok('read-later item stays to-read', slow.unread === true);
  ok('original date preserved', beans.savedAt === 1600000000 * 1000);

  // re-import dedupes
  const res2 = s.importBookmarks(entries, { foldersAsLabels: true, readMode: 'handled' });
  eq('re-import skips duplicates', res2.skipped, 2);
})();

// --- paste list ---
eq('parse pasted links', parseLinkList('https://a.com\nnot a link\nb.com/x').length, 2);

// summary sanity
ok('summarize counts', summarize(parseNetscapeBookmarks(sampleHtml)).count === 2);

export function runTests() {
  const passed = results.filter(r => r.pass).length;
  return { passed, failed: results.length - passed, total: results.length, results };
}
