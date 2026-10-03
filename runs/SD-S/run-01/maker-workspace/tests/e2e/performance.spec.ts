import { expect, test } from '@playwright/test';
import { resetBookmarks, seedBookmarks } from '../fixtures/bookmarks';

test.beforeEach(() => resetBookmarks());

test('loads and searches a 1,000 bookmark collection within one second', async ({ page }) => {
  seedBookmarks('/tmp/bookmark-manager-e2e.db', 1000);
  const started = Date.now();
  await page.goto('/');
  await expect(page.locator('[data-harness-ready="true"]')).toBeVisible();
  expect(Date.now() - started).toBeLessThan(1000);
  await expect(page.getByText('1,000 places worth returning to')).toBeVisible();
  const searchStarted = Date.now();
  await page.getByLabel('Search bookmarks').fill('Unique performance needle');
  await expect(page.getByRole('link', { name: 'Unique performance needle' })).toBeVisible();
  expect(Date.now() - searchStarted).toBeLessThan(1000);
  await page.getByRole('button', { name: 'Clear filters' }).click();
  const filterStarted = Date.now();
  await page.getByRole('combobox', { name: 'Tag', exact: true }).selectOption('Research');
  await expect(page.getByText(/places worth returning to/)).toBeVisible();
  expect(Date.now() - filterStarted).toBeLessThan(1000);
});
