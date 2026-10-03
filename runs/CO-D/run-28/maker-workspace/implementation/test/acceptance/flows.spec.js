const { test, expect } = require('@playwright/test');

// Add a bookmark through the Option-C panel (metadata may fail offline; the draft
// still opens per SCN-009). Returns after it appears in the list.
async function addBookmark(page, url, title, tags = []) {
  await page.fill('#url', url);
  await page.click('#add');
  await page.waitForSelector('.draft .d-url');
  await page.fill('.draft .d-title', title);
  for (const t of tags) { await page.fill('.taginput input', t); await page.keyboard.press('Enter'); }
  await page.click('.draft .d-save');
  await expect(page.locator('.bm .title a', { hasText: title })).toBeVisible();
}

test.beforeEach(async ({ page, request }) => {
  // isolate: remove any existing bookmarks and collections before each test
  const bs = await (await request.get('/api/bookmarks')).json();
  for (const b of bs.bookmarks) await request.delete('/api/bookmarks/' + b.id);
  const cs = await (await request.get('/api/collections')).json();
  for (const c of cs.collections) await request.delete('/api/collections/' + c.id);
  await page.goto('/');
  await page.waitForSelector('body[data-harness-ready="true"]');
});

// SCN-001 / SCN-009
test('save a link and it appears', async ({ page }) => {
  await addBookmark(page, 'https://alpha.example/one', 'Alpha One');
  await expect(page.locator('.bm')).toHaveCount(1);
});

// SCN-008 — re-saving opens existing, no duplicate
test('re-saving the same link does not duplicate', async ({ page }) => {
  await addBookmark(page, 'https://beta.example/x', 'Beta X');
  await page.fill('#url', 'https://beta.example/x/'); // trailing slash variant
  await page.click('#add');
  await expect(page.locator('#status')).toContainText('already saved');
  await expect(page.locator('.bm')).toHaveCount(1);
});

// SCN-003 / SCN-005 — search
test('search filters across fields and supports #tag', async ({ page }) => {
  await addBookmark(page, 'https://g.example/grid', 'CSS grid layout', ['css']);
  await addBookmark(page, 'https://f.example/', 'Figma design', ['design']);
  await page.fill('#search', 'grid');
  await expect(page.locator('.bm')).toHaveCount(1);
  await page.fill('#search', '#design');
  await expect(page.locator('.bm .title a', { hasText: 'Figma design' })).toBeVisible();
  await page.fill('#search', '(css');
  await expect(page.locator('#searcherr')).toContainText("isn't complete");
});

// SCN-006 / SCN-007 — read later + archive views
test('read-later and archive views', async ({ page }) => {
  await addBookmark(page, 'https://r.example/a', 'Read Me');
  await page.click('.bm .star');
  await page.click('#views >> text=To read');
  await expect(page.locator('.bm .title a', { hasText: 'Read Me' })).toBeVisible();
  await page.click('#views >> text=All');
  await page.click('.bm .arch');
  await expect(page.locator('.bm')).toHaveCount(0); // hidden from All
  await page.click('#views >> text=Archived');
  await expect(page.locator('.bm .title a', { hasText: 'Read Me' })).toBeVisible();
});

// SCN-014 — permanent delete with confirm
test('delete requires confirmation then removes', async ({ page }) => {
  await addBookmark(page, 'https://d.example/x', 'Delete Me');
  await page.click('.bm .del');
  await expect(page.locator('.actions .confirm')).toBeVisible();
  await page.click('.actions .confirm-yes');
  await expect(page.locator('.bm')).toHaveCount(0);
});

// SCN-017 — save and apply a collection
test('save a collection and apply it', async ({ page }) => {
  await addBookmark(page, 'https://c1.example/', 'Ref One', ['reference']);
  await addBookmark(page, 'https://c2.example/', 'Other', ['misc']);
  await page.fill('#search', '#reference');
  await page.click('.collections .save');
  await page.fill('.collections form input', 'My Refs');
  await page.click('.collections form button');
  await page.fill('#search', '');
  await expect(page.locator('.bm')).toHaveCount(2);
  await page.click('.collections .coll >> text=My Refs');
  await expect(page.locator('.bm')).toHaveCount(1);
  await expect(page.locator('.bm .title a', { hasText: 'Ref One' })).toBeVisible();
});
