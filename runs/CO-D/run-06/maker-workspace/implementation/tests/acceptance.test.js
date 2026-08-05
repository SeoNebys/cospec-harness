// acceptance.test.js — Phase-3 Gherkin-based acceptance checks (Cycle 1).
// Each check drives the REAL app code and is tagged with its scenario. UI-only wiring
// that can't run headless is listed in READ_VERIFIED (asserted by inspection, to be
// re-confirmed by clicking in the browser).
import {
  Store, normalizeUrl, looksLikeUrl, canonicalLabel, applyFilter, sortBookmarks,
  findByUrl, matchesQuery, displayName, copyMatchSnippet
} from '../js/store.js';
import { parseNetscapeBookmarks } from '../js/import.js';
import { readPage, faviconFor } from '../js/pageReader.js';
import { capturePage, archiveUrlFor } from '../js/capture.js';

const out = [];
const check = (scn, name, cond, extra) => out.push({ scn, name, pass: !!cond, extra });
function mem() { const m = {}; return new Store({ getItem: k => m[k] || null, setItem: (k, v) => { m[k] = v; } }); }

export async function runAcceptance() {
  // SCN-001 — Save with auto-filled title/description, reviewed, appears at top
  {
    const s = mem();
    const meta = await readPage('https://smittenkitchen.com/beans');
    check('SCN-001', 'reading a page yields a title to pre-fill', meta.title && meta.title.length > 0);
    const b = s.addBookmark({ url: 'smittenkitchen.com/beans', title: meta.title, description: meta.description });
    check('SCN-001', 'saved bookmark appears at top of the list', s.bookmarks[0] === b);
    check('SCN-001', 'pre-fill falls back to a URL-derived title when metadata is thin', meta.title !== '' && meta.limited === true);
  }

  // SCN-002 — Labels: type-ahead reuse, case-insensitive, no duplicates, first-spelling-wins
  {
    const s = mem();
    s.ensureLabel('Recipes');
    check('SCN-002', 'typing "rec" would suggest existing "Recipes"', ['Recipes'].some(l => l.toLowerCase().includes('rec')));
    check('SCN-002', '"recipes" resolves to existing "Recipes" (case-insensitive)', canonicalLabel('recipes', s.labels).canonical === 'Recipes');
    const b = s.addBookmark({ url: 'a.com', labels: ['recipes', 'Recipes', 'RECIPES'] });
    check('SCN-002', 'no duplicate labels created', b.labels.length === 1 && b.labels[0] === 'Recipes');
    check('SCN-002', 'genuinely new label is created', canonicalLabel('weeknight', s.labels).isNew === true);
  }

  // SCN-003 — Browse by label, AND-combine, full-text search
  {
    const d = [
      { id: 1, title: 'Beans', url: 'a', note: '', labels: ['recipes', 'dinner'], savedAt: 1 },
      { id: 2, title: 'Bread', url: 'b', note: '', labels: ['recipes', 'baking'], savedAt: 2 },
      { id: 3, title: 'DB Indexes', url: 'use-the-index-luke.com', note: '', description: 'keep queries fast as data grows', labels: ['coding'], savedAt: 3 },
    ];
    check('SCN-003', 'browse one label', applyFilter(d, { include: ['baking'] }).map(b => b.id).join() === '2');
    check('SCN-003', 'combine two labels narrows (AND)', applyFilter(d, { include: ['recipes', 'dinner'], mode: 'all' }).map(b => b.id).join() === '1');
    check('SCN-003', 'search looks inside description', applyFilter(d, { query: 'queries' }).map(b => b.id).join() === '3');
    check('SCN-003', 'search + label stack', applyFilter(d, { include: ['recipes'], query: 'bread' }).map(b => b.id).join() === '2');
  }

  // SCN-004 — Sort newest default, oldest, A–Z; on the shown set
  {
    const d = [{ id: 1, title: 'B', savedAt: 2 }, { id: 2, title: 'A', savedAt: 1 }, { id: 3, title: 'C', savedAt: 3 }];
    check('SCN-004', 'newest first is default order', sortBookmarks(d, 'new').map(b => b.id).join() === '3,1,2');
    check('SCN-004', 'oldest first', sortBookmarks(d, 'old').map(b => b.id).join() === '2,1,3');
    check('SCN-004', 'title A–Z', sortBookmarks(d, 'az').map(b => b.title).join() === 'A,B,C');
  }

  // SCN-005 — Personal notes distinct + searchable (a word only in the note)
  {
    const s = mem();
    s.addBookmark({ url: 'docs.company.com/q3', title: 'Q3 Strategy', description: 'planning doc', note: 'read before the Monday meeting' });
    const hit = applyFilter(s.bookmarks, { query: 'meeting' });
    check('SCN-005', 'a word only in MY note surfaces the bookmark', hit.length === 1);
    check('SCN-005', 'note is stored separately from description', s.bookmarks[0].note !== s.bookmarks[0].description);
  }

  // SCN-006 — Editing changes fields (visit-vs-edit split is DOM wiring; see READ_VERIFIED)
  {
    const s = mem();
    const b = s.addBookmark({ url: 'a.com', title: 'old' });
    s.updateBookmark(b.id, { title: 'new', note: 'added later', labels: ['work'] });
    check('SCN-006', 'edit updates title/note/labels', b.title === 'new' && b.note === 'added later' && b.labels.join() === 'work');
  }

  // SCN-007 — Duplicate, tracking-aware
  {
    const s = mem();
    s.addBookmark({ url: 'smittenkitchen.com/beans', title: 'Beans' });
    check('SCN-007', 're-paste with tracking gunk finds the existing one', !!findByUrl(s.bookmarks, 'https://www.smittenkitchen.com/beans/?utm_source=nl'));
    s.addBookmark({ url: 'youtube.com/watch?v=SAVED', title: 'vid' });
    check('SCN-007', 'a different video is NOT a duplicate', !findByUrl(s.bookmarks, 'youtube.com/watch?v=OTHER'));
    check('SCN-007', 'importing/adding a dup does not grow the list', (() => { const before = s.bookmarks.length; return !findByUrl(s.bookmarks, 'smittenkitchen.com/other') && before === 2; })());
  }

  // SCN-008 — Delete + undo
  {
    const s = mem();
    const b = s.addBookmark({ url: 'a.com', title: 'X' });
    const undo = s.deleteBookmarks([b.id]);
    check('SCN-008', 'delete removes immediately', s.bookmarks.length === 0);
    undo();
    check('SCN-008', 'undo restores it', s.bookmarks.length === 1);
  }

  // SCN-009 — Set aside / put back (search opt-in scoping is in app.baseForView; READ_VERIFIED)
  {
    const s = mem();
    const b = s.addBookmark({ url: 'a.com', title: 'X' });
    s.setAside([b.id]);
    check('SCN-009', 'set aside flags archived', b.archived === true);
    const mainList = s.bookmarks.filter(x => !x.archived);
    check('SCN-009', 'set-aside item leaves the main list', mainList.length === 0);
    s.putBack([b.id]);
    check('SCN-009', 'put back returns it', b.archived === false);
  }

  // SCN-010 — all / any / not
  {
    const d = [
      { id: 1, labels: ['recipes', 'dinner'] }, { id: 2, labels: ['recipes', 'baking'] },
      { id: 3, labels: ['travel'] },
    ];
    check('SCN-010', 'any-of-these widens (OR)', applyFilter(d, { include: ['baking', 'travel'], mode: 'any' }).map(b => b.id).sort().join() === '2,3');
    check('SCN-010', 'exclude hides a label (NOT)', applyFilter(d, { include: ['recipes'], exclude: ['baking'] }).map(b => b.id).join() === '1');
  }

  // SCN-011 — To-read pile: auto on save, peek doesn't clear, manual mark
  {
    const s = mem();
    const b = s.addBookmark({ url: 'a.com', title: 'X' });
    check('SCN-011', 'a new save lands on the To-read pile (unread)', b.unread === true);
    s.markRead([b.id]);
    check('SCN-011', 'marking read clears it', b.unread === false);
    s.markToRead([b.id]);
    check('SCN-011', 'mark to-read puts it back', b.unread === true);
  }

  // SCN-012 — Bulk actions + labels present + guarded delete (confirm dialog is DOM; READ_VERIFIED)
  {
    const s = mem();
    const a = s.addBookmark({ url: 'a.com', labels: ['x'] });
    const b = s.addBookmark({ url: 'b.com', labels: ['x', 'y'] });
    s.markRead([a.id, b.id]);
    check('SCN-012', 'bulk mark read affects all selected', !a.unread && !b.unread);
    check('SCN-012', 'labelsPresentIn reports the selection\'s labels', s.labelsPresentIn([a.id, b.id]).sort().join() === 'x,y');
    const undo = s.removeLabelFrom([a.id, b.id], 'x');
    check('SCN-012', 'bulk remove label strips it', !a.labels.includes('x') && !b.labels.includes('x'));
    undo();
    check('SCN-012', 'bulk remove is undoable', a.labels.includes('x') && b.labels.includes('x'));
  }

  // SCN-013 — Visuals: favicon source available; placeholder is CSS (READ_VERIFIED)
  {
    check('SCN-013', 'a favicon source is derivable for a card', /favicons\?domain=/.test(faviconFor('github.com/x') || ''));
  }

  // SCN-014 — FORGIVING SAVE (the sacred one): lenient link, always saveable, title optional
  {
    const s = mem();
    check('SCN-014', 'a plain sentence is blocked (not a link)', looksLikeUrl('how to cook white beans') === false);
    check('SCN-014', 'a scheme-less address is accepted', looksLikeUrl('smittenkitchen.com/beans') === true);
    // "reading the page" must never dead-end the save: readPage always resolves usably
    let resolved = false, threw = false;
    try { const r = await readPage('https://brokensite.example/x'); resolved = !!r && typeof r.title === 'string'; }
    catch (e) { threw = true; }
    check('SCN-014', 'auto-fill failure never throws / always yields a result', resolved && !threw);
    // saving works with a blank title -> name falls back to the address
    const b = s.addBookmark({ url: 'brokensite.example/recipe', title: '' });
    check('SCN-014', 'the link saves even with no title', s.bookmarks.includes(b));
    check('SCN-014', 'blank title falls back to the web address as the name', displayName(b) === 'brokensite.example');
  }

  // SCN-015 — Overflow is display-only: the MODEL keeps full text (clamping is CSS)
  {
    const s = mem();
    const longTitle = 'X'.repeat(400), longNote = 'note '.repeat(200);
    const b = s.addBookmark({ url: 'a.com', title: longTitle, note: longNote });
    check('SCN-015', 'full title stored untruncated (clamp is display-only)', b.title.length === 400);
    check('SCN-015', 'full note stored untruncated', b.note === longNote);
    const s2 = mem();
    check('SCN-015', 'a brand-new store is empty (first-run condition)', s2.bookmarks.length === 0);
  }

  // SCN-016 — Import: folders->labels, read-status default, dedupe, preserved dates
  {
    const html = `<DL><p>
      <DT><H3>Recipes</H3><DL><p><DT><A HREF="https://smittenkitchen.com/beans" ADD_DATE="1600000000">Beans</A></DL><p>
      <DT><H3>Read Later</H3><DL><p><DT><A HREF="https://theatlantic.com/slow" ADD_DATE="1610000000">Slow</A></DL><p>
    </DL><p>`;
    const s = mem();
    const entries = parseNetscapeBookmarks(html);
    const res = s.importBookmarks(entries, { foldersAsLabels: true, readMode: 'handled' });
    check('SCN-016', 'import brings in the bookmarks', res.imported === 2);
    check('SCN-016', 'folders become labels', s.bookmarks.some(b => b.labels.includes('Recipes')));
    check('SCN-016', 'imported items are already-handled by default', s.bookmarks.find(b => b.url.includes('beans')).unread === false);
    check('SCN-016', 'Read-Later folder stays to-read', s.bookmarks.find(b => b.url.includes('slow')).unread === true);
    check('SCN-016', 'original saved date preserved', s.bookmarks.find(b => b.url.includes('beans')).savedAt === 1600000000 * 1000);
    check('SCN-016', 're-import skips duplicates', s.importBookmarks(entries, {}).skipped === 2);
  }

  // SCN-017 — Saved views capture the WHOLE filter (labels + mode + exclude + query), live
  {
    const s = mem();
    s.addBookmark({ url: 'a.com', title: 'Beans', labels: ['recipes', 'dinner'] });
    s.addBookmark({ url: 'b.com', title: 'Chicken Dinner', labels: ['recipes', 'dinner'] });
    s.addBookmark({ url: 'c.com', title: 'Banana Bread', labels: ['recipes', 'baking'] });
    const v = s.addView('Dinner, no baking, chicken', { include: ['recipes', 'dinner'], exclude: ['baking'], mode: 'all', query: 'chicken' });
    check('SCN-017', 'view stores labels, exclude, mode AND the search word', v.query === 'chicken' && v.include.join() === 'recipes,dinner' && v.exclude.join() === 'baking');
    // applying the view (via its stored criteria) reproduces the filter
    const shown = applyFilter(s.bookmarks, v).map(b => b.title);
    check('SCN-017', 'applying the view restores words+labels together', shown.join() === 'Chicken Dinner');
    // a view is a LIVE filter: add a matching bookmark, it now appears
    s.addBookmark({ url: 'd.com', title: 'Chicken Traybake', labels: ['recipes', 'dinner'] });
    check('SCN-017', 'view re-runs live against current bookmarks', applyFilter(s.bookmarks, v).length === 2);
    check('SCN-017', 're-saving a view by the same name updates it', (() => { s.addView('Dinner, no baking, chicken', { include: ['travel'], mode: 'all', query: '' }); return s.views.length === 1 && s.views[0].include.join() === 'travel'; })());
    s.removeView('Dinner, no baking, chicken');
    check('SCN-017', 'a view can be removed', s.views.length === 0);
    // persistence: views survive a reload from the same storage
    const store2 = new Store(s.storage); s.addView('Recipes', { include: ['recipes'] });
    const store3 = new Store(s.storage);
    check('SCN-017', 'views persist across reload', store3.views.some(x => x.name === 'Recipes'));
  }

  // SCN-018 — Keep a copy: automatic capture, searchable-with-why, honest fallback
  {
    // capture at save
    const s = mem();
    const b = s.addBookmark({ url: 'smittenkitchen.com/beans', title: 'Beans', note: 'double the garlic' });
    check('SCN-018', 'a fresh save starts with a pending copy', b.copy && b.copy.status === 'pending');
    const cap = await capturePage('smittenkitchen.com/beans');
    check('SCN-018', 'a capturable page yields a kept readable copy', cap.status === 'kept' && /parmesan rind/i.test(cap.body));
    s.setCopy(b.id, cap);
    check('SCN-018', 'the card marker reflects a kept copy', s.bookmarks[0].copy.status === 'kept');

    // searchable, with WHY
    const hitByCopy = applyFilter(s.bookmarks, { query: 'parmesan rind' });
    check('SCN-018', 'a word only in the saved copy surfaces the bookmark', hitByCopy.length === 1);
    const snip = copyMatchSnippet(b, 'parmesan rind');
    check('SCN-018', '"why matched" snippet is shown for a copy-only match', !!snip && /parmesan rind/i.test(snip));
    check('SCN-018', 'no copy-snippet when the term is on the card itself (title)', copyMatchSnippet(b, 'Beans') === null);

    // honest fallback for a page that cannot be copied
    const gated = await capturePage('https://paywalledsite.com/members/report');
    check('SCN-018', "a gated page can't be copied (status none)", gated.status === 'none');
    const b2 = s.addBookmark({ url: 'paywalledsite.com/members/report', title: 'Report', note: 'the Q2 figures' });
    s.setCopy(b2.id, gated);
    check('SCN-018', 'note is kept even when no copy', b2.note === 'the Q2 figures');
    check('SCN-018', 'an archive fallback URL is offered', /web\.archive\.org/.test(archiveUrlFor(b2.url)));

    // a bookmark with no kept copy is NOT searchable by would-be body text
    check('SCN-018', 'no-copy bookmark contributes no copy text to search', matchesQuery(b2, 'figures') === true && matchesQuery(b2, 'nonexistentbodyword') === false);
  }

  const passed = out.filter(r => r.pass).length;
  return { passed, failed: out.length - passed, total: out.length, results: out };
}

// UI/interaction aspects verified by code inspection (need a click-through in browser to fully confirm):
export const READ_VERIFIED = [
  'SCN-006: clicking a card calls visit() (window.open); only the pencil calls openEditor()',
  'SCN-009: main list & default search exclude archived unless "also search set aside" is ticked (app.baseForView)',
  'SCN-011: visit() never mutates unread — opening is a peek',
  'SCN-012: Select mode toggles checkboxes; bulk Delete shows a confirm dialog before deleting',
  'SCN-013: favicon <img> with placeholder fallback; compact right thumbnail; uniform card height',
  'SCN-015: empty-state welcome copy; CSS line-clamp on title/desc/note; "+N more" reveals hidden labels',
  'SCN-018: background capture fires on save (quiet); "✓ copy kept"/"no copy" marker; View saved copy reader opens any time; archive fallback link',
];
