import { test, expect } from '@playwright/test';

const FIX = 'http://127.0.0.1:4020';

test.beforeEach(async ({ page }) => {
  await page.request.post('/api/_test/reset');
  await page.goto('/');
  await page.waitForSelector('[data-harness-ready="true"]');
});

async function saveOnce(page, url) {
  await page.fill('#url', url);
  await page.click('#fetchBtn');
  await page.waitForSelector('#metaPreview.show');
  await page.click('#saveBtn');
}

// SCN-002
test('SCN-002: re-saving an existing link updates it instead of duplicating', async ({ page }) => {
  await saveOnce(page, `${FIX}/mdn`);
  await expect(page.locator('#count')).toHaveText('1 bookmark');

  // Same page, different protocol/trailing slash — should be recognised as same.
  await page.fill('#url', `${FIX}/mdn/`);
  await page.click('#fetchBtn');
  await page.waitForSelector('#metaPreview.show');
  await page.click('#saveBtn'); // duplicate attempt

  await expect(page.locator('#modeBanner')).toContainText('already saved');
  await expect(page.locator('#saveBtn')).toHaveText('Update bookmark');
  await expect(page.locator('#count')).toHaveText('1 bookmark'); // no duplicate

  await page.fill('#note', 'revisited');
  await page.click('#saveBtn'); // confirm update
  await expect(page.locator('#count')).toHaveText('1 bookmark');
  await expect(page.locator('.bm .note')).toContainText('revisited');
});

// SCN-002
test('SCN-002: edit a saved bookmark directly', async ({ page }) => {
  await saveOnce(page, `${FIX}/mdn`);
  await page.click('.bm [data-act="edit"]');
  await expect(page.locator('#saveBtn')).toHaveText('Update bookmark');
  await page.fill('#title', 'My retitled bookmark');
  await page.click('#saveBtn');
  await expect(page.locator('.bm .title')).toContainText('My retitled bookmark');
  await expect(page.locator('#count')).toHaveText('1 bookmark');
});
