import { test, expect } from '@playwright/test';

async function saveFallback(page, address) {
  await page.getByRole('button', { name: '+ Save a link' }).click();
  await page.getByLabel('Paste a web address').fill(address);
  await page.getByRole('button', { name: 'Save link' }).click();
  await expect(page.getByText('Page details weren’t available.')).toBeVisible();
}

test('approved bookmark lifecycle and organization flows work together', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-harness-ready="true"]')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Your first useful bookmark starts here' })).toBeVisible();

  await page.getByRole('button', { name: '+ Save a link' }).click();
  await page.getByLabel('Paste a web address').fill('example');
  await page.getByRole('button', { name: 'Save link' }).click();
  await expect(page.getByText('Please enter a complete web address')).toBeVisible();

  await page.getByLabel('Paste a web address').fill('https://first.invalid/article');
  await page.getByRole('button', { name: 'Save link' }).click();
  await expect(page.getByText('Page details weren’t available.')).toBeVisible();
  await expect(page.getByText('1 bookmark')).toBeVisible();

  let card = page.locator('.bookmark-card').first();
  await card.getByLabel('More actions').click();
  await card.getByRole('button', { name: 'Edit title & description' }).click();
  await card.locator('.inline-editor input').fill('Workshop reading');
  await card.locator('.inline-editor textarea').fill('A useful guide for the team.');
  await card.getByRole('button', { name: 'Save changes' }).click();
  card = page.locator('.bookmark-card').first();
  await expect(card.getByRole('link', { name: 'Workshop reading' })).toBeVisible();

  await card.getByLabel('More actions').click();
  await card.getByRole('button', { name: 'Add tag' }).click();
  await page.getByLabel('Tag').fill('Reading');
  await page.getByRole('button', { name: /Create “Reading”/ }).click();
  card = page.locator('.bookmark-card').first();
  await expect(card.getByRole('button', { name: 'Reading' })).toBeVisible();

  await card.getByLabel('More actions').click();
  await card.getByRole('button', { name: 'Add a note' }).click();
  await page.getByLabel('Your note').fill('Use this for the workshop');
  await page.getByRole('button', { name: 'Save note' }).click();
  await expect(page.locator('.bookmark-card').first().getByText('Use this for the workshop')).toBeVisible();

  await page.locator('.bookmark-card').first().getByRole('button', { name: '◷ Read later' }).click();
  await page.locator('.nav-item[data-view="readLater"]').click();
  await expect(page.getByRole('heading', { name: 'Read later' })).toBeVisible();
  await page.getByRole('button', { name: '✓ Mark as read' }).click();
  await expect(page.getByRole('heading', { name: 'You’re all caught up' })).toBeVisible();

  await page.locator('.nav-item[data-view="all"]').click();
  await page.getByPlaceholder('Search titles, descriptions, notes, and URLs').fill('workshop');
  await expect(page.getByText('Results for “workshop”')).toBeVisible();
  await page.getByPlaceholder('Search titles, descriptions, notes, and URLs').fill('quokka');
  await expect(page.getByRole('heading', { name: 'No results for “quokka”' })).toBeVisible();
  await page.getByPlaceholder('Search titles, descriptions, notes, and URLs').fill('');

  card = page.locator('.bookmark-card').first();
  await card.getByLabel('More actions').click();
  await card.getByRole('button', { name: 'Move to Archive' }).click();
  await page.locator('.nav-item[data-view="archive"]').click();
  await page.getByRole('button', { name: 'Restore' }).click();
  await page.locator('.nav-item[data-view="all"]').click();

  await saveFallback(page, 'https://second.invalid/article');
  await page.locator('.select-bookmark').nth(0).check();
  await page.locator('.select-bookmark').nth(1).check();
  await expect(page.getByText('2 selected')).toBeVisible();
  await page.locator('#bulk-bar').getByRole('button', { name: '+ Add tag' }).click();
  await page.getByLabel('Tag').fill('Reading');
  await page.locator('#suggestions button').filter({ hasText: 'Reading' }).click();
  await expect(page.locator('.bookmark-card').filter({ hasText: 'Reading' })).toHaveCount(2);

  await page.locator('.select-bookmark').nth(0).check();
  await page.locator('.select-bookmark').nth(1).check();
  await page.locator('#bulk-bar').getByRole('button', { name: 'Delete…' }).click();
  await expect(page.getByRole('heading', { name: 'Permanently delete 2 bookmarks?' })).toBeVisible();
  await page.getByRole('button', { name: 'Delete 2 permanently' }).click();
  await expect(page.getByRole('heading', { name: 'Your first useful bookmark starts here' })).toBeVisible();
});

test('exact duplicate returns to the existing bookmark', async ({ page }) => {
  await page.goto('/');
  await saveFallback(page, 'https://duplicate.invalid/page');
  await page.getByRole('button', { name: '+ Save a link' }).click();
  await page.getByLabel('Paste a web address').fill('https://duplicate.invalid/page');
  await page.getByRole('button', { name: 'Save link' }).click();
  await expect(page.getByText('Already saved — showing your existing bookmark')).toBeVisible();
  await expect(page.locator('.bookmark-card')).toHaveCount(1);
});
