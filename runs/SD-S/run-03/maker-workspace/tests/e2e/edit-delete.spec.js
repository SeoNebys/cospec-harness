import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page, request }) => {
  await request.post('/api/test/reset');
  await request.post('/api/bookmarks', { data: { url: 'https://edit.example', title: 'Original' } });
  await page.goto('/');
  await expect(page.locator('#app')).toHaveAttribute('data-harness-ready', 'true');
});

test('edits a title and persists after reload', async ({ page }) => {
  await page.locator('.bookmark button[data-action=edit]').click();
  const form = page.locator('.bookmark--editing form');
  await form.locator('input[name=title]').fill('Renamed');
  await form.locator('button[type=submit]').click();

  await expect(page.locator('.bookmark__title').filter({ hasText: 'Renamed' })).toHaveCount(1);

  await page.reload();
  await expect(page.locator('#app')).toHaveAttribute('data-harness-ready', 'true');
  await expect(page.locator('.bookmark__title').filter({ hasText: 'Renamed' })).toHaveCount(1);
});

test('deletes a bookmark after confirmation', async ({ page }) => {
  page.on('dialog', (dialog) => dialog.accept());
  await page.locator('.bookmark button[data-action=delete]').click();

  await expect(page.locator('.bookmark')).toHaveCount(0);
  await expect(page.locator('#empty-state')).toBeVisible();

  await page.reload();
  await expect(page.locator('#app')).toHaveAttribute('data-harness-ready', 'true');
  await expect(page.locator('.bookmark')).toHaveCount(0);
});

test('cancelling the confirmation keeps the bookmark', async ({ page }) => {
  page.on('dialog', (dialog) => dialog.dismiss());
  await page.locator('.bookmark button[data-action=delete]').click();
  await expect(page.locator('.bookmark')).toHaveCount(1);
});
