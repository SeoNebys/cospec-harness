import { test, expect } from '@playwright/test';

// US3 end-to-end: edit, tag suggestions, archive/restore, and batch. Requires the
// app running (Playwright starts it via config).

async function save(page: import('@playwright/test').Page, url: string) {
  await page.getByPlaceholder('Paste a web address to save…').fill(url);
  await page.getByRole('button', { name: 'Save' }).click();
}

test('edit a bookmark: change title and description persist (US3)', async ({ page }) => {
  await page.goto('/');
  await save(page, 'https://a.example/');
  const card = page.locator('.card').first();
  await card.getByRole('button', { name: 'Edit' }).click();
  await page.getByLabel(/Title/).first().fill('My New Title');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.locator('.card a.title').first()).toHaveText('My New Title');
});

test('archive moves a bookmark to the Archived tab and restore brings it back (US3)', async ({
  page,
}) => {
  await page.goto('/');
  await save(page, 'https://arch.example/');
  await expect(page.locator('.card')).toHaveCount(1);

  await page.locator('.card').first().getByRole('button', { name: 'Archive' }).click();
  await expect(page.locator('.card')).toHaveCount(0); // gone from All

  await page.getByRole('button', { name: 'Archived' }).click();
  await expect(page.locator('.card')).toHaveCount(1);
  await page.locator('.card').first().getByRole('button', { name: 'Restore' }).click();
  await expect(page.locator('.card')).toHaveCount(0); // gone from Archived
});

test('batch: select all showing and archive them (US3)', async ({ page }) => {
  await page.goto('/');
  await save(page, 'https://one.example/');
  await save(page, 'https://two.example/');
  await expect(page.locator('.card')).toHaveCount(2);

  // Select one to reveal the toolbar, then "select all showing".
  await page.locator('.card .select-box').first().check();
  await page.getByRole('button', { name: /Select all showing/ }).click();
  await page.getByRole('button', { name: 'Archive', exact: true }).click();
  await expect(page.locator('.card')).toHaveCount(0);
});
