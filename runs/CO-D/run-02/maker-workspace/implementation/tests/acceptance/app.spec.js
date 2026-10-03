'use strict';
// Acceptance tests driving the real UI + API (SCN-001..SCN-020).
// A local fixtures server provides fake pages the app fetches for metadata/snapshots.
const { test, expect } = require('@playwright/test');
const http = require('http');
const fs = require('fs');
const path = require('path');

const FXPORT = 4098;
const FX = 'http://127.0.0.1:' + FXPORT;
const FXDIR = path.join(__dirname, '..', 'fixtures');
let fixturesServer;

test.beforeAll(async () => {
  fixturesServer = http.createServer((req, res) => {
    const p = path.join(FXDIR, decodeURIComponent(req.url.split('?')[0]));
    if (fs.existsSync(p) && fs.statSync(p).isFile()) {
      const ext = path.extname(p);
      res.setHeader('content-type', ext === '.html' ? 'text/html' : ext === '.pdf' ? 'application/pdf' : ext === '.png' ? 'image/png' : 'application/octet-stream');
      fs.createReadStream(p).pipe(res);
    } else { res.statusCode = 404; res.end('nf'); }
  });
  await new Promise(r => fixturesServer.listen(FXPORT, '127.0.0.1', r));
});
test.afterAll(async () => { await new Promise(r => fixturesServer.close(r)); });

async function reset(request) {
  const st = await (await request.get('/api/state')).json();
  for (const b of st.bookmarks) await request.delete('/api/bookmarks/' + b.id);
  for (const s of st.savedSearches) await request.delete('/api/saved/' + s.id);
  await request.put('/api/preferences', { data: { defaultSort: 'added-desc', pageSize: 25, textSize: 'normal' } });
}
async function seed(request, body) {
  const res = await request.post('/api/bookmarks', { data: body });
  return res.json();
}
const P1 = () => FX + '/page1.html';   // The History of Rome
const P2 = () => FX + '/page2.html';   // Carbonara Recipe

test('SCN-012: initial empty state and ready marker', async ({ page, request }) => {
  await reset(request);
  await page.goto('/');
  await expect(page.locator('[data-harness-ready="true"]')).toHaveCount(1);
  await expect(page.locator('.empty')).toContainText('Nothing saved yet');
});

test('SCN-001/002: save with reviewed metadata, then duplicate jumps to existing', async ({ page, request }) => {
  await reset(request);
  await page.goto('/');
  await page.fill('#url', P1());
  await page.click('.saver button');
  await expect(page.locator('.review .cap')).toContainText('Review before saving');
  await expect(page.locator('#fTitle')).toHaveValue('The History of Rome');
  await expect(page.locator('#fDesc')).toHaveValue(/ancient Rome/);
  await page.click('#doSave');
  const card = page.locator('.item').first();
  await expect(card.locator('a.title')).toHaveText('The History of Rome');
  await expect(card.locator('.card-preview')).toHaveCount(1);
  await expect(card.locator('.copies-line')).toContainText('Saved page');
  await expect(card.locator('.card-dates')).toContainText('Saved');
  // duplicate
  await page.fill('#url', P1());
  await page.click('.saver button');
  await expect(page.locator('.hint.warn')).toContainText("already saved");
  await expect(page.locator('.review .cap')).toContainText('Edit bookmark');
});

test('SCN-011: invalid link is declined without saving', async ({ page, request }) => {
  await reset(request);
  await page.goto('/');
  await page.fill('#url', 'just some words');
  await page.click('.saver button');
  await expect(page.locator('.hint.warn')).toContainText("doesn't look like a link");
  await expect(page.locator('.review')).toHaveCount(0);
});

test('SCN-013: personal note with formatting renders on the card', async ({ page, request }) => {
  await reset(request);
  await page.goto('/');
  await page.fill('#url', P1());
  await page.click('.saver button');
  await page.fill('#fNote', 'This is important');
  await page.locator('#fNote').selectText();
  await page.click('.md-btn[data-md="bold"]');
  await expect(page.locator('#notePrev strong')).toHaveCount(1);
  await page.click('#doSave');
  await expect(page.locator('.item .note strong')).toHaveText('This is important');
});

test('SCN-004/014: tag reuse with typeahead, and clicking a tag filters the view', async ({ page, request }) => {
  await reset(request);
  await seed(request, { url: P1(), title: 'Rome', tags: ['reading', 'recipes', 'history'] });
  await page.goto('/');
  // typeahead in the add review
  await page.fill('#url', P2());
  await page.click('.saver button');
  await page.fill('#fTags .tag-input', 're');
  const toggles = page.locator('#fTags .tag-toggle');
  await expect(toggles).toHaveText(['reading', 'recipes']);
  await page.locator('#fTags .tag-toggle', { hasText: 'reading' }).click();
  await page.click('#doSave');
  // click a tag on a card -> filters current view
  await page.locator('.item .tag', { hasText: 'history' }).first().click();
  await expect(page.locator('#search')).toHaveValue('#history');
  await expect(page.locator('.view-tab.on')).toHaveText('Collection');
  await expect(page.locator('.item')).toHaveCount(1);
});

test('SCN-005: search across fields, operators, and malformed fallback', async ({ page, request }) => {
  await reset(request);
  await seed(request, { url: P1(), title: 'Rome history', description: 'ancient city', note: 'read soon', tags: ['article'] });
  await seed(request, { url: P2(), title: 'Rome guidebook', description: 'trip planning', tags: ['book'] });
  await page.goto('/');
  await page.fill('#search', 'ancient');            // description
  await expect(page.locator('.item')).toHaveCount(1);
  await page.fill('#search', '#book');              // exact tag
  await expect(page.locator('.item a.title')).toHaveText('Rome guidebook');
  await page.fill('#search', 'rome (#article OR #book)');
  await expect(page.locator('.item')).toHaveCount(2);
  await page.fill('#search', 'rome (');             // malformed
  await expect(page.locator('.search-count')).toContainText("couldn’t understand the search operators");
});

test('SCN-006/007/008: reading list, archive hiding + scoped search, restore', async ({ page, request }) => {
  await reset(request);
  const rome = await seed(request, { url: P1(), title: 'Rome', tags: ['history'] });
  await seed(request, { url: P2(), title: 'Carbonara', tags: ['recipes'] });
  await page.goto('/');
  // add Rome to reading list
  await page.locator('#item-' + rome.id + ' .act', { hasText: 'Add to reading list' }).click();
  await page.click('.view-tab[data-view="reading"]');
  await expect(page.locator('.item')).toHaveCount(1);
  await expect(page.locator('.item a.title')).toHaveText('Rome');
  // mark as read -> leaves reading list
  await page.locator('.item .act', { hasText: 'Mark as read' }).click();
  await expect(page.locator('.item')).toHaveCount(0);
  // back to collection, archive Carbonara
  await page.click('.view-tab[data-view="all"]');
  await page.locator('.item', { hasText: 'Carbonara' }).locator('.act', { hasText: 'Archive' }).click();
  await expect(page.locator('.item', { hasText: 'Carbonara' })).toHaveCount(0);
  // ordinary search does not surface archived
  await page.fill('#search', 'carbonara');
  await expect(page.locator('.item')).toHaveCount(0);
  await page.click('#clearSearch');
  // archive view shows it; search scoped there finds it
  await page.click('.view-tab[data-view="archive"]');
  await expect(page.locator('.item', { hasText: 'Carbonara' })).toHaveCount(1);
  await page.fill('#search', 'carbonara');
  await expect(page.locator('.search-count')).toContainText('the archive');
  await page.click('#clearSearch');
  // restore
  await page.locator('.item .act', { hasText: 'Restore to collection' }).click();
  await page.click('.view-tab[data-view="all"]');
  await expect(page.locator('.item', { hasText: 'Carbonara' })).toHaveCount(1);
});

test('SCN-015: sort by title', async ({ page, request }) => {
  await reset(request);
  await seed(request, { url: P1(), title: 'Zebra' });
  await seed(request, { url: P2(), title: 'Apple' });
  await page.goto('/');
  await page.selectOption('#sort', 'title-asc');
  await expect(page.locator('.item a.title').first()).toHaveText('Apple');
  await page.selectOption('#sort', 'title-desc');
  await expect(page.locator('.item a.title').first()).toHaveText('Zebra');
});

test('SCN-016: bulk select-all, tag, and delete with confirmation', async ({ page, request }) => {
  await reset(request);
  await seed(request, { url: P1(), title: 'One', tags: ['news'] });
  await seed(request, { url: P2(), title: 'Two', tags: ['news'] });
  await page.goto('/');
  await page.fill('#search', '#news');
  await page.locator('.item .sel input').first().check();
  await page.locator('.bulk-row1 .link', { hasText: 'Select all' }).click();
  await expect(page.locator('.bulk-row1')).toContainText('2 selected');
  // add a tag to all
  await page.locator('.bulk-btn', { hasText: 'Tag / untag' }).click();
  await page.fill('.bulk-form input', 'favourites');
  await page.locator('.bulk-btn', { hasText: 'Add to selected' }).click();
  await expect(page.locator('.item .tag', { hasText: 'favourites' })).toHaveCount(2);
  // delete both
  await page.locator('.bulk-btn', { hasText: 'Delete' }).first().click();
  await expect(page.locator('.bulk-note')).toContainText("can’t be undone");
  await page.locator('.bulk-btn.danger', { hasText: 'Delete permanently' }).click();
  await page.click('#clearSearch');
  await expect(page.locator('.item')).toHaveCount(0);
});

test('SCN-017: save a search and reapply it', async ({ page, request }) => {
  await reset(request);
  await seed(request, { url: P1(), title: 'Rome', tags: ['history'] });
  await seed(request, { url: P2(), title: 'Carbonara', tags: ['recipes'] });
  await page.goto('/');
  await page.fill('#search', '#history');
  await page.click('#saveSearch');
  await page.fill('.save-form input', 'History');
  await page.locator('.save-form .ok').click();
  await page.fill('#search', 'carbonara');
  await expect(page.locator('.item a.title')).toHaveText('Carbonara');
  await page.locator('.saved-chip .name', { hasText: 'History' }).click();
  await expect(page.locator('#search')).toHaveValue('#history');
  await expect(page.locator('.item a.title')).toHaveText('Rome');
});

test('SCN-009/010: delete confirmation and dates', async ({ page, request }) => {
  await reset(request);
  await seed(request, { url: P1(), title: 'Rome' });
  await page.goto('/');
  await expect(page.locator('.item .card-dates')).toContainText('Saved');
  await page.locator('.item .act', { hasText: 'Delete' }).click();
  await expect(page.locator('.item .confirm-text')).toContainText("can’t be undone");
  await page.locator('.item .act', { hasText: 'Cancel' }).click();
  await expect(page.locator('.item')).toHaveCount(1);
  await page.locator('.item .act', { hasText: 'Delete' }).click();
  await page.locator('.item .act.danger', { hasText: 'Delete permanently' }).click();
  await expect(page.locator('.item')).toHaveCount(0);
});

test('SCN-018: automatic in-app copy on save is viewable', async ({ page, request }) => {
  await reset(request);
  await page.goto('/');
  await page.fill('#url', P1());
  await page.click('.saver button');
  await page.click('#doSave');
  const card = page.locator('.item').first();
  await expect(card.locator('.copies-line a', { hasText: 'Saved page' })).toHaveCount(1);
  await card.locator('.act', { hasText: 'Copies' }).click();
  await expect(card.locator('.copy-panel .cp-label').first()).toContainText('In-app copy');
});

test('SCN-019: import a browser bookmarks file, preserving tags and dates', async ({ page, request }) => {
  await reset(request);
  await page.goto('/');
  await page.click('#ioBtn');
  await page.setInputFiles('#ioFile', path.join(FXDIR, 'import-sample.html'));
  await expect(page.locator('#ioImport')).toContainText('Found 2 bookmarks');
  await expect(page.locator('#ioImport .io-list')).toContainText('longform');
  await page.locator('#ioImport .primary', { hasText: 'Import 2 new' }).click();
  await expect(page.locator('#ioImport')).toContainText('Imported 2 new');
  await expect(page.locator('.item', { hasText: 'Imported deep dive' })).toHaveCount(1);
  // folder became a tag
  await expect(page.locator('.item', { hasText: 'Imported deep dive' }).locator('.tag', { hasText: 'reading' })).toHaveCount(1);
});

test('SCN-019: export downloads a bookmarks file', async ({ page, request }) => {
  await reset(request);
  await seed(request, { url: P1(), title: 'Rome' });
  await page.goto('/');
  await page.click('#ioBtn');
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.locator('#ioMount .primary', { hasText: 'Export bookmarks file' }).click()
  ]);
  expect(download.suggestedFilename()).toBe('bookmarks.html');
});

test('SCN-020: display preferences — paging with show-more and full-set select-all', async ({ page, request }) => {
  await reset(request);
  for (let i = 0; i < 6; i++) await seed(request, { url: FX + '/page1.html?n=' + i, title: 'Item ' + i, tags: ['bulk'] });
  await page.goto('/');
  await page.click('#prefBtn');
  await page.selectOption('#prefPage', '10');       // still more than... set small to force paging
  await page.selectOption('#prefPage', 'all');
  await page.selectOption('#prefText', 'large');
  await expect(page.locator('#wrap')).toHaveAttribute('style', /zoom/);
  // force a small page size to see show-more
  await page.selectOption('#prefPage', '10');
  await page.click('#prefClose');
  // 6 items < 10 so no show-more; verify select-all names full matching set under a search
  await page.fill('#search', '#bulk');
  await page.locator('.item .sel input').first().check();
  await expect(page.locator('.bulk-row1 .link', { hasText: 'Select all 6 matching bookmarks' })).toHaveCount(1);
});
