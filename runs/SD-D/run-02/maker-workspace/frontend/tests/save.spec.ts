import { test, expect } from '@playwright/test';
import { resetAll } from './helpers.js';

const FIXTURE = 'http://127.0.0.1:4600';

test.beforeEach(async ({ request }) => {
  await resetAll(request);
});

/**
 * US1 (T014): save-with-auto-details journey, plus the duplicate-opens-existing
 * behavior and jotting a note — the flows the client most wanted to try.
 */
test('saving a link fills in its title and preview on its own', async ({ page }) => {
  await page.goto('/');

  await page.locator('.add-url').fill(`${FIXTURE}/article`);
  await page.getByRole('button', { name: 'Save', exact: true }).click();

  // The fetched title appears without any manual reload.
  await expect(page.getByText('The Great Fixture Article')).toBeVisible({ timeout: 15_000 });
  // And the preview image the app fetched from the page.
  await expect(page.locator('.preview')).toHaveAttribute('src', /preview\.png/, { timeout: 15_000 });
});

test('saving a link you already have opens the existing one, and notes persist', async ({ page }) => {
  await page.goto('/');
  await page.locator('.add-url').fill(`${FIXTURE}/article`);
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('The Great Fixture Article')).toBeVisible({ timeout: 15_000 });

  // Save the same link again -> the existing bookmark opens for editing (no duplicate).
  await page.locator('.add-url').fill(`${FIXTURE}/article`);
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('opening the one you have')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Edit bookmark' })).toBeVisible();

  // Only one card exists.
  await expect(page.locator('.card')).toHaveCount(1);

  // Jot a note in the open editor and save.
  await page.locator('.notes-surface').click();
  await page.keyboard.type('Remember this bit');
  await page.getByRole('button', { name: 'Save changes' }).click();

  // Reopen and confirm the note is still there.
  await page.locator('.card-actions').getByRole('button', { name: 'Edit' }).click();
  await expect(page.locator('.notes-surface')).toContainText('Remember this bit');
});

test('an invalid address is rejected with a clear message', async ({ page }) => {
  await page.goto('/');
  await page.locator('.add-url').fill('not a real address');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.locator('.field-error')).toBeVisible();
});
