import { test, expect } from '@playwright/test';
import { resetApp } from './reset.js';

test.beforeEach(async ({ request }) => { await resetApp(request); });

// Proves "select all matching" (FR-022) applies beyond the visible page.
test('select all matching archives every result across pages', async ({ page, request }) => {
  // Seed 12 bookmarks and shrink the page size so results span multiple pages.
  for (let i = 0; i < 12; i++) {
    await request.post('/api/bookmarks', { data: { url: `https://bulk${i}.example`, title: `Bulk ${i}` } });
  }
  await request.put('/api/preferences', { data: { defaultSort: 'newest', itemsPerView: 5, textSize: 'medium' } });

  await page.goto('/');
  await expect(page.locator('body[data-harness-ready="true"]')).toBeVisible();

  // Only a page of results is shown, but the total is 12.
  await expect(page.locator('.card')).toHaveCount(5);
  await expect(page.locator('#result-summary')).toHaveText(/12 bookmarks/);

  // Select the visible page, then escalate to all matching.
  await page.check('#select-all');
  const escalate = page.locator('#bulk-escalate');
  await expect(escalate).toBeVisible();
  await expect(escalate).toHaveText(/Select all 12 matching/);
  await escalate.click();
  await expect(page.locator('#bulk-count')).toHaveText(/All 12 matching selected/);

  // Bulk archive -> every matching bookmark, not just the visible 5.
  await page.locator('#bulk-bar [data-bulk="archive"]').click();

  await page.click('.nav[data-view="all"]');
  await expect(page.locator('.card')).toHaveCount(0);

  await page.click('.nav[data-view="archive"]');
  await expect(page.locator('#result-summary')).toHaveText(/12 bookmarks/);
});
