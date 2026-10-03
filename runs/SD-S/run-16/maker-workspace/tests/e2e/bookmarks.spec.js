import { test, expect } from '@playwright/test';

// End-to-end happy path. The server runs with METADATA_STUB=1 (see
// playwright.config.js) so enrichment is deterministic and offline.

test('save → appears immediately → enrichment fills in → search → edit → delete', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#app')).toHaveAttribute('data-harness-ready', 'true');

  const unique = `e2e-${Date.now()}.example.com/page`;

  // Save a bookmark.
  await page.fill('#add-url', unique);
  await page.fill('#add-tags', 'e2e');
  await page.click('#add-submit');

  // Appears immediately (URL-derived title, fetching badge).
  const card = page.locator('.card').first();
  await expect(card).toBeVisible();
  await expect(card.locator('.card-url')).toContainText(unique);

  // Background enrichment fills in the stubbed title.
  await expect(card.locator('.card-title a')).toContainText('Preview of', { timeout: 8000 });
  await expect(card.locator('.badge.fetching')).toHaveCount(0);

  // Search narrows the list.
  await page.fill('#search', 'e2e-');
  await expect(page.locator('.card')).toHaveCount(1);

  // No-match shows empty state.
  await page.fill('#search', 'zzzz-nomatch');
  await expect(page.locator('#empty-state')).toBeVisible();
  await page.fill('#search', '');

  // Edit the title.
  await page.click('.edit-btn');
  await expect(page.locator('#edit-dialog')).toBeVisible();
  await page.fill('#edit-title', 'Edited E2E Title');
  await page.click('#edit-save');
  await expect(page.locator('.card-title a').first()).toContainText('Edited E2E Title');

  // Delete (auto-accept the confirm dialog).
  page.on('dialog', (d) => d.accept());
  await page.click('.edit-btn');
  await page.click('#edit-delete');
  await expect(page.locator('.card')).toHaveCount(0);
});
