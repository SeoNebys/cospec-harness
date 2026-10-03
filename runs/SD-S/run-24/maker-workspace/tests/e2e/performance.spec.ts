import { expect, test } from '@playwright/test';

import { seedPerformanceBookmarks } from '../helpers/seed-performance.js';

test('finds a known item among 5,000 with a visible update under one second', async ({ page }) => {
  seedPerformanceBookmarks();
  await page.goto('/');
  await expect(page.locator('[data-harness-ready="true"]')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('5000 saved links')).toBeVisible();

  const started = performance.now();
  await page.getByLabel('Search bookmarks').fill('Unique needle for scale validation');
  await expect(page.getByRole('heading', { name: 'Known performance target' })).toBeVisible();
  const elapsed = performance.now() - started;
  expect(elapsed).toBeLessThan(1_000);
});
