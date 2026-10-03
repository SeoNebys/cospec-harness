import { expect, test } from '@playwright/test';
import { resetBookmarks } from '../fixtures/bookmarks';

test.beforeEach(() => resetBookmarks());

test('preserves durable records, rolls back a failed mutation, and avoids horizontal overflow', async ({ page }, testInfo) => {
  const suffix = testInfo.project.name;
  const title = `Long resilient ${suffix} ${'title '.repeat(30)}`.slice(0, 300);
  const response = await page.request.post('/api/bookmarks', { data: {
    url: `https://unavailable.invalid/${suffix}/${'path-'.repeat(80)}`,
    title,
    notes: 'Long note '.repeat(300),
    tags: Array.from({ length: 20 }, (_, index) => `tag-${suffix}-${index}`),
  } });
  expect(response.ok()).toBeTruthy();
  await page.goto('/');
  await expect(page.getByRole('link', { name: title })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('link', { name: title })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.route('**/api/bookmarks/*', (route) => route.abort());
  await page.getByRole('article').filter({ has: page.getByRole('link', { name: title }) }).getByRole('button', { name: /add .* to favorites/i }).click();
  await expect(page.locator('[aria-live="polite"]')).toContainText(/could not update/i);
  await expect(page.getByRole('article').filter({ has: page.getByRole('link', { name: title }) })).not.toContainText('Favorite');
});
