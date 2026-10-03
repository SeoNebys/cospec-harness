import { expect, test } from '@playwright/test';
import { navigate, saveBookmark, signIn } from './helpers';

test('complete v1 smoke walkthrough keeps state across navigation', async ({ page }, testInfo) => {
  const suffix = `${testInfo.project.name}-${Date.now()}`;
  const title = `Acceptance ${suffix}`;
  await signIn(page);
  await saveBookmark(page, {
    url: `https://example.com/acceptance-${suffix}`,
    title,
    readLater: true,
    favorite: true,
  });
  for (const view of ['Library', 'Read Later', 'Favorites']) {
    await navigate(page, view);
    await expect(page.getByRole('button', { name: `View details for ${title}` })).toBeVisible();
  }
  await page.reload();
  await expect(page.locator('[data-harness-ready="true"]')).toBeVisible();
  await page.getByLabel('Search bookmarks').fill(`"${title}"`);
  await expect(page.getByRole('button', { name: `View details for ${title}` })).toBeVisible();
});
