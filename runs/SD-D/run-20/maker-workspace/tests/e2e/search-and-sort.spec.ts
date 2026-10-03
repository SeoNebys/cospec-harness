import { test, expect } from '@playwright/test';
import { createBookmark, removeBookmark } from './helpers';
test('advanced search, clickable tags and sort controls work together', async ({ page, request }) => {
  const stamp = Date.now();
  const one = await createBookmark(request, `Alpha design ${stamp}`, {
    description: 'systems handbook',
    tagLabels: ['Research'],
  });
  const two = await createBookmark(request, `Zulu garden ${stamp}`, { tagLabels: ['Personal'] });
  await page.goto('/');
  await page.getByLabel('Search bookmarks').fill(`"design ${stamp}" AND #research`);
  const alphaCard = page.getByRole('article').filter({ hasText: `Alpha design ${stamp}` });
  await expect(alphaCard).toBeVisible();
  await expect(page.getByText(`Zulu garden ${stamp}`)).toBeHidden();
  await page.getByRole('button', { name: 'Clear all' }).click();
  await page.getByLabel('Sort bookmarks').selectOption('title-desc');
  await alphaCard.getByRole('button', { name: 'Filter by tag Research' }).click();
  await expect(page.getByText(`Alpha design ${stamp}`)).toBeVisible();
  await removeBookmark(request, one.id);
  await removeBookmark(request, two.id);
});
