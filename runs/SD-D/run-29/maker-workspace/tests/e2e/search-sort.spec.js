import { test, expect } from '@playwright/test';
import { ready, seed, uid } from './helpers.js';

test('rich rows, open target, sort, and advanced search', async ({ page }) => {
  const k = uid();
  await ready(page);
  await seed(page, { title: `${k} Climate news today`, description: 'global warming', tags: [`${k}news`, `${k}common`] });
  await seed(page, { title: `${k} Machine learning primer`, description: 'a primer', tags: [`${k}blog`, `${k}common`] });
  await seed(page, { title: `${k} Climate opinion piece`, description: 'editorial', tags: [`${k}common`] });

  // Rows show title, description, tags, favicon; title links to target (FR-008/009)
  await page.fill('#search', `${k} Climate news`);
  await expect(page.locator('.card')).toHaveCount(1);
  const card = page.locator('.card').first();
  await expect(card.locator('.title')).toContainText('Climate news today');
  await expect(card.locator('.desc')).toContainText('global warming');
  await expect(card.locator('.chip')).toHaveCount(2);
  await expect(card.locator('a.title')).toHaveAttribute('target', '_blank');
  await expect(card.locator('a.title')).toHaveAttribute('href', /index\.html\?seed=/);

  // Exact phrase
  await page.fill('#search', `"machine learning"`);
  await expect(page.locator('.card')).toHaveCount(1);
  await expect(page.locator('.card .title')).toContainText('Machine learning primer');

  // #tag search
  await page.fill('#search', `#${k}news`);
  await expect(page.locator('.card')).toHaveCount(1);

  // Boolean with grouping + NOT
  await page.fill('#search', `#${k}common AND ${k} climate NOT opinion`);
  await expect(page.locator('.card')).toHaveCount(1);
  await expect(page.locator('.card .title')).toContainText('Climate news today');

  // No results state
  await page.fill('#search', `${k} zzznotthere`);
  await expect(page.locator('#empty-state')).toBeVisible();

  // Sort by title A-Z vs Z-A (scope to this test's items via #tag)
  await page.fill('#search', `#${k}common`);
  await expect(page.locator('.card')).toHaveCount(3);

  await page.selectOption('#sort', 'title_asc');
  // Wait for the re-render to settle before reading the order
  await expect(page.locator('.card .title').first()).toContainText('Climate news today');
  const asc = await page.locator('.card .title').allTextContents();

  await page.selectOption('#sort', 'title_desc');
  await expect(page.locator('.card .title').first()).toContainText('Machine learning primer');
  const desc = await page.locator('.card .title').allTextContents();

  expect(asc).toEqual([...desc].reverse());
});
