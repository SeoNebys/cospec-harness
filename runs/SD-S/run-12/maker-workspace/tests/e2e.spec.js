import { test, expect } from '@playwright/test';

// End-to-end flow: save → list → open → edit → delete (quickstart.md 1–3).
// Runs against the throwaway server started by playwright.config.js (in-memory DB).

test('save, browse, open, edit, and delete a bookmark', async ({ page, context }) => {
  await page.goto('/');
  await expect(page.locator('#app[data-harness-ready="true"]')).toBeVisible();

  // Empty state on first load (US2 / FR-012).
  await expect(page.locator('#empty-state')).toBeVisible();

  // Save a bookmark (US1) — scheme-less url is normalized to https.
  await page.fill('#add-url', 'example.com');
  await page.fill('#add-title', 'Example Site');
  await page.fill('#add-tags', 'reading');
  await page.click('#add-form button[type="submit"]');

  const item = page.locator('.bookmark-item').first();
  await expect(item).toBeVisible();
  await expect(item.locator('.bookmark-title')).toHaveText('Example Site');
  await expect(item.locator('.bookmark-url')).toHaveText('https://example.com/');

  // Opening the bookmark uses the saved url in a new tab (US2 / FR-006).
  const link = item.locator('.bookmark-title');
  await expect(link).toHaveAttribute('href', 'https://example.com/');
  await expect(link).toHaveAttribute('target', '_blank');

  // Edit the title (US3 / FR-007).
  await item.getByRole('button', { name: 'Edit' }).click();
  await page.fill('#edit-title', 'Renamed Site');
  await page.click('#edit-form button[type="submit"]');
  await expect(page.locator('.bookmark-item .bookmark-title')).toHaveText('Renamed Site');

  // Delete with confirmation (US3 / FR-008).
  page.once('dialog', (dialog) => dialog.accept());
  await page.locator('.bookmark-item').getByRole('button', { name: 'Delete' }).click();
  await expect(page.locator('.bookmark-item')).toHaveCount(0);
  await expect(page.locator('#empty-state')).toBeVisible();
});

test('search narrows results and shows a no-results state (US4)', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#app[data-harness-ready="true"]')).toBeVisible();

  const entries = [
    ['news.com', 'Morning News'],
    ['docs.com', 'Reference Docs'],
  ];
  for (let i = 0; i < entries.length; i++) {
    const [url, title] = entries[i];
    await page.fill('#add-url', url);
    await page.fill('#add-title', title);
    await page.click('#add-form button[type="submit"]');
    // Wait for this add to land before starting the next (the form saves async).
    await expect(page.locator('.bookmark-item')).toHaveCount(i + 1);
  }

  await page.fill('#search', 'reference');
  await expect(page.locator('.bookmark-item')).toHaveCount(1);
  await expect(page.locator('.bookmark-item .bookmark-title')).toHaveText('Reference Docs');

  await page.fill('#search', 'zzznothing');
  await expect(page.locator('.bookmark-item')).toHaveCount(0);
  await expect(page.locator('#no-results')).toBeVisible();
});
