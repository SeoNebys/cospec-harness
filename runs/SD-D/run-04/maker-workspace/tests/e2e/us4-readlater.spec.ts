import { test, expect } from '@playwright/test';

// US4 end-to-end: flag "read later" and view the shortlist. App started by config.

async function save(page: import('@playwright/test').Page, url: string) {
  await page.getByPlaceholder('Paste a web address to save…').fill(url);
  await page.getByRole('button', { name: 'Save' }).click();
}

test('flag read-later and see it in the Read Later tab (US4)', async ({ page }) => {
  await page.goto('/');
  await save(page, 'https://later.example/');
  await save(page, 'https://other.example/');

  // Flag the first card.
  await page
    .locator('.card')
    .first()
    .getByRole('button', { name: /Read later/ })
    .click();

  await page.getByRole('button', { name: 'Read Later' }).click();
  await expect(page.locator('.card')).toHaveCount(1);

  // Clearing the flag removes it from the Read Later view.
  await page
    .locator('.card')
    .first()
    .getByRole('button', { name: /Read later/ })
    .click();
  await expect(page.locator('.card')).toHaveCount(0);
});
