import { test, expect } from '@playwright/test';

// US1 end-to-end: save a bookmark and see it as a card. Requires the app running
// (`npm run dev`); Playwright starts it via playwright.config.ts webServer.
// NOTE: enrichment reaches the live web, so this asserts the card appears and the
// address is shown — not specific fetched preview text.

test('save a bookmark and see it in the list (US1)', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Bookmarks' })).toBeVisible();

  const input = page.getByPlaceholder('Paste a web address to save…');
  await input.fill('example.com');
  await page.getByRole('button', { name: 'Save' }).click();

  // Card appears with the normalized address; the title links out to the page.
  const card = page.locator('.card').first();
  await expect(card).toBeVisible();
  await expect(card.locator('.url')).toContainText('example.com');
  await expect(card.locator('a.title')).toHaveAttribute('target', '_blank');
});

test('rejects a malformed address (US1 scenario 3)', async ({ page }) => {
  await page.goto('/');
  await page.getByPlaceholder('Paste a web address to save…').fill('not a url');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.locator('.form-error')).toBeVisible();
});
