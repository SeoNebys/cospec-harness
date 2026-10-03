import { test, expect } from '@playwright/test';
import { uniqueUrl, createBookmark } from './helpers.js';

test('US3: list shows details; sort reorders; open works', async ({ page, request }) => {
  const tag = `sort${Date.now()}`;
  await createBookmark(request, { url: uniqueUrl(), title: 'Zebra', description: 'desc-z', tags: [tag] });
  await createBookmark(request, { url: uniqueUrl(), title: 'Apple', description: 'desc-a', tags: [tag] });

  await page.goto(`/#/?includeTags=${tag}`);
  // Both visible with description shown.
  await expect(page.getByText('desc-z')).toBeVisible();
  await expect(page.getByText('desc-a')).toBeVisible();

  // Sort by title A–Z → Apple before Zebra.
  await page.getByLabel('sort').selectOption('title_asc');
  const titles = await page.locator('.card .title').allInnerTexts();
  const idxApple = titles.findIndex((t) => t.includes('Apple'));
  const idxZebra = titles.findIndex((t) => t.includes('Zebra'));
  expect(idxApple).toBeLessThan(idxZebra);

  // Open link targets a new tab.
  const link = page.locator('.card .title a').first();
  await expect(link).toHaveAttribute('target', '_blank');
});

test('US3: empty search shows a no-results state', async ({ page }) => {
  await page.goto('/#/?q=zzz-no-such-term-zzz');
  await expect(page.locator('.empty')).toBeVisible();
});
