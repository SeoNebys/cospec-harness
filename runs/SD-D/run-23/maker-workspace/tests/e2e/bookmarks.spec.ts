import { test, expect } from '@playwright/test';

test('capture, read-later, search, archive and restore', async ({ page }) => {
  const title = `Browser acceptance ${Date.now()}`;
  await page.goto('/');
  await page.getByLabel('Email').fill('review@example.test');
  await page.getByLabel('Password').fill('bookmark-review');
  await page.getByRole('button', { name: 'Enter library' }).click();
  await expect(page.locator('[data-harness-ready="true"]')).toBeVisible();
  await page.getByRole('button', { name: /Add bookmark/ }).first().click();
  await page.getByLabel('Web address').fill(`https://example.com/e2e-${Date.now()}`);
  await page.getByLabel('Title').fill(title);
  await page.getByRole('button', { name: 'Save bookmark' }).click();
  const card = page.locator('.bookmark-card').filter({ has: page.getByRole('link', { name: title }) });
  await expect(card).toBeVisible();
  await page.getByLabel('Search bookmarks').fill(title);
  await expect(card).toBeVisible();
  await card.getByRole('button', { name: 'Mark read' }).click();
  await card.getByTitle('Archive').click();
  await expect(card).not.toBeVisible();
  await page.getByRole('button', { name: 'Archive', exact: true }).click();
  const archivedCard = page.locator('.bookmark-card').filter({ has: page.getByRole('link', { name: title }) });
  await expect(archivedCard).toBeVisible();
  await archivedCard.getByTitle('Restore').click();
  await expect(archivedCard).not.toBeVisible();
});
