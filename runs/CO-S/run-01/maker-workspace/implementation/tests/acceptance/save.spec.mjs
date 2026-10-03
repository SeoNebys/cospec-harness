import { test, expect } from '@playwright/test';

const FIX = 'http://127.0.0.1:4020';

test.beforeEach(async ({ page }) => {
  await page.request.post('/api/_test/reset');
  await page.goto('/');
  await page.waitForSelector('[data-harness-ready="true"]');
});

// SCN-001
test('SCN-001: save a new link with auto-filled details, tags and note', async ({ page }) => {
  await page.fill('#url', `${FIX}/mdn`);
  await page.click('#fetchBtn');
  await page.waitForSelector('#metaPreview.show');
  await expect(page.locator('#title')).toHaveValue(/MDN/);

  await page.fill('#tags', 'reference, javascript');
  await page.fill('#note', 'handy cheatsheet');
  await page.click('#saveBtn');

  await expect(page.locator('#count')).toHaveText('1 bookmark');
  const card = page.locator('.bm').first();
  await expect(card.locator('.title')).toContainText('MDN');
  await expect(card.locator('.url a')).toHaveText(`${FIX}/mdn`);
  await expect(card.locator('.chip')).toHaveCount(2);
  await expect(card.locator('.note')).toContainText('handy cheatsheet');
});

// SCN-001 empty state
test('SCN-001/SCN-008: empty collection shows an invitation, not a blank list', async ({ page }) => {
  await expect(page.locator('#count')).toHaveText('0 bookmarks');
  await expect(page.locator('.empty')).toContainText('Nothing here yet');
});

// SCN-007
test('SCN-007: details lookup fails but saving is not blocked', async ({ page }) => {
  await page.fill('#url', 'http://127.0.0.1:59999/unreachable');
  await page.click('#fetchBtn');
  await expect(page.locator('#fetchState')).toContainText("Couldn't get this page's details");
  await expect(page.locator('#metaPreview')).toHaveClass(/show/);

  await page.fill('#title', 'Manually titled');
  await page.click('#saveBtn');
  await expect(page.locator('#count')).toHaveText('1 bookmark');
  await expect(page.locator('.bm .title')).toContainText('Manually titled');
});

// SCN-007
test('SCN-007: text that is not a link gives a gentle message and no bookmark', async ({ page }) => {
  await page.fill('#url', 'not a link');
  await page.click('#fetchBtn');
  await expect(page.locator('#fetchState')).toContainText("doesn't look like a link");
  await expect(page.locator('#metaPreview')).not.toHaveClass(/show/);
  await expect(page.locator('#count')).toHaveText('0 bookmarks');
});

// persistence
test('bookmarks persist across a reload', async ({ page }) => {
  await page.fill('#url', `${FIX}/flexbox`);
  await page.click('#fetchBtn');
  await page.waitForSelector('#metaPreview.show');
  await page.click('#saveBtn');
  await expect(page.locator('#count')).toHaveText('1 bookmark');

  await page.reload();
  await page.waitForSelector('[data-harness-ready="true"]');
  await expect(page.locator('#count')).toHaveText('1 bookmark');
  await expect(page.locator('.bm .title')).toContainText('Flexbox');
});
