import { test, expect } from '@playwright/test';
import { largeLibrary } from '../helpers/seedLargeLibrary';

test('updates a 10,000-bookmark sort within one second', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile', 'Scale timing is measured once on desktop.');
  test.setTimeout(60_000);
  const newest = largeLibrary('newest');
  const alphabetical = largeLibrary('title');
  await page.route('**/api/bookmarks?*', async (route) => {
    const sort = new URL(route.request().url()).searchParams.get('sort');
    await route.fulfill({ json: sort === 'title' ? alphabetical : newest });
  });
  await page.goto('/');
  await expect(page.locator('[data-harness-ready="true"]')).toBeVisible();
  const started = performance.now();
  await page.getByLabel('Sort bookmarks').selectOption('title');
  await expect(page.locator('article').first().getByText('Bookmark 00000', { exact: false })).toBeVisible();
  expect(performance.now() - started).toBeLessThan(1000);
});
