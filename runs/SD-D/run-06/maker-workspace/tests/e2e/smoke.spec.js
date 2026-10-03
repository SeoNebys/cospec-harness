import { test, expect } from '@playwright/test';
import { resetApp } from './reset.js';

// End-to-end smoke of the primary flows against a live server (started by the
// Playwright webServer config). Confirms the harness readiness marker too.
test.beforeEach(async ({ request }) => { await resetApp(request); });

test('save, tag, search, archive smoke', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('body[data-harness-ready="true"]')).toBeVisible();

  // Save a bookmark.
  await page.fill('#add-url', 'https://playwright.dev');
  await page.fill('#add-title', 'Playwright Docs');
  await page.click('#add-form button[type="submit"]');
  await expect(page.locator('.card .title', { hasText: 'Playwright Docs' })).toBeVisible();

  // Edit to add a tag.
  await page.locator('.card', { hasText: 'Playwright Docs' }).getByRole('button', { name: 'Edit' }).click();
  await expect(page.locator('.modal')).toBeVisible();
  const tagInput = page.locator('.modal label', { hasText: 'Tags' }).locator('+ input');
  await tagInput.fill('testing, docs');
  await page.locator('.modal button', { hasText: 'Save' }).click();
  await expect(page.locator('.card .tag', { hasText: 'testing' })).toBeVisible();

  // Search finds it.
  await page.fill('#search-input', 'playwright');
  await page.click('#search-form button[type="submit"]');
  await expect(page.locator('.card .title', { hasText: 'Playwright Docs' })).toBeVisible();

  // Clear search, then archive it.
  await page.click('#search-clear');
  await page.locator('.card', { hasText: 'Playwright Docs' }).getByRole('button', { name: 'Archive', exact: true }).click();
  await page.click('.nav[data-view="all"]');
  await expect(page.locator('.card .title', { hasText: 'Playwright Docs' })).toHaveCount(0);

  // Present in the archive view.
  await page.click('.nav[data-view="archive"]');
  await expect(page.locator('.card .title', { hasText: 'Playwright Docs' })).toBeVisible();
});
