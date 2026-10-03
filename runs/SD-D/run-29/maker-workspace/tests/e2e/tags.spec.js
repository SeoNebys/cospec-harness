import { test, expect } from '@playwright/test';
import { ready, seed, uid } from './helpers.js';

test('tag suggestions while typing; add/remove persists; filter by tag', async ({ page }) => {
  const k = uid();
  await ready(page);
  await seed(page, { title: `${k} Alpha`, tags: [`${k}science`] });
  await seed(page, { title: `${k} Beta`, tags: [`${k}sports`] });

  // Filter by clicking a tag chip
  await page.fill('#search', `${k} Alpha`);
  await expect(page.locator('.card')).toHaveCount(1);
  await page.locator('.card .chip', { hasText: `#${k}science` }).click();
  await expect(page.locator('#active-filter')).toBeVisible();
  await expect(page.locator('.card')).toHaveCount(1);
  await expect(page.locator('.card .title')).toContainText(`${k} Alpha`);

  // Clear filter
  await page.locator('#active-filter button').click();

  // Edit Beta: type an existing tag prefix -> suggestion appears
  await page.fill('#search', `${k} Beta`);
  await expect(page.locator('.card')).toHaveCount(1);
  const betaCard = page.locator('.card', { hasText: `${k} Beta` });
  await expect(betaCard).toBeVisible();
  await betaCard.getByRole('button', { name: 'Edit' }).click();
  await page.waitForSelector('.modal');
  const tagField = page.locator('.modal .suggest input');
  await tagField.fill(`${k}sci`);
  await expect(page.locator('.modal .suggest-list li')).toContainText(`#${k}science`);
  await page.locator('.modal .suggest-list li', { hasText: `#${k}science` }).click();
  await page.click('.modal button.primary');

  // Beta now carries both tags -> filtering by science shows Alpha and Beta
  await page.fill('#search', `#${k}science`);
  await expect(page.locator('.card')).toHaveCount(2);
  await expect(page.locator('.card', { hasText: `${k} Beta` })).toHaveCount(1);
});
