import { test, expect } from '@playwright/test';

test('US13: preferences persist and apply across reload', async ({ page, request }) => {
  await page.goto('/#/preferences');
  page.on('dialog', (d) => d.accept());

  await page.getByLabel('default sort').selectOption('title_asc');
  await page.getByLabel('items per page').fill('40');
  await page.getByLabel('font size').selectOption('large');

  // Persisted server-side.
  await expect
    .poll(async () => (await (await request.get('/api/preferences')).json()).fontSize)
    .toBe('large');
  const prefs = await (await request.get('/api/preferences')).json();
  expect(prefs).toMatchObject({ defaultSort: 'title_asc', itemsPerPage: 40, fontSize: 'large' });

  // Applied after reload: font scale set and list sort defaults to the saved value.
  await page.goto('/#/');
  await expect
    .poll(async () =>
      page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--font-scale').trim())
    )
    .toBe('1.15');
  await expect(page.getByLabel('sort')).toHaveValue('title_asc');
});
