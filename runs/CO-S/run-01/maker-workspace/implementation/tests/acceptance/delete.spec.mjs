import { test, expect } from '@playwright/test';

const SEED = [
  { url: 'https://a.com/1', title: 'Alpha' },
  { url: 'https://b.com/2', title: 'Bravo' }
];

test.beforeEach(async ({ page }) => {
  await page.request.post('/api/_test/reset');
  for (const b of SEED) await page.request.post('/api/bookmarks', { data: b });
  await page.goto('/');
  await page.waitForSelector('[data-harness-ready="true"]');
});

// SCN-009
test('SCN-009: delete asks for confirmation; cancel keeps the bookmark', async ({ page }) => {
  const alpha = page.locator('.bm', { hasText: 'Alpha' });
  await alpha.locator('[data-act="delete"]').click();
  await expect(alpha.locator('.confirm-text')).toContainText("can't be undone");
  await expect(page.locator('#count')).toHaveText('2 bookmarks'); // nothing removed yet

  await alpha.locator('[data-act="canceldelete"]').click();
  await expect(page.locator('#count')).toHaveText('2 bookmarks');
  await expect(page.locator('.confirm-text')).toHaveCount(0);
});

// SCN-009
test('SCN-009: confirming delete removes permanently (not to Archived)', async ({ page }) => {
  const alpha = page.locator('.bm', { hasText: 'Alpha' });
  await alpha.locator('[data-act="delete"]').click();
  await alpha.locator('[data-act="confirmdelete"]').click();

  await expect(page.locator('#count')).toHaveText('1 bookmark');
  await expect(page.locator('#vc-archived')).toHaveText('(0)'); // not archived
  await page.click('[data-view="archived"]');
  await expect(page.locator('.empty')).toContainText('Nothing archived');
});
