import { test, expect } from '@playwright/test';

test('font size and items-per-page preferences apply and persist', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.app')).toHaveAttribute('data-harness-ready', 'true');

  // Font size.
  await page.locator('.pref', { hasText: 'Font size' }).locator('select').selectOption('large');
  await expect(page.locator('.app')).toHaveClass(/fs-large/);

  // Items per page.
  await page.locator('.pref', { hasText: 'Items per page' }).locator('input').fill('10');
  await page.locator('.pref', { hasText: 'Items per page' }).locator('input').blur();

  // Persist across reload.
  await page.reload();
  await expect(page.locator('.app')).toHaveClass(/fs-large/);
  await expect(page.locator('.pref', { hasText: 'Items per page' }).locator('input')).toHaveValue('10');

  // Reset to defaults so later manual review starts clean.
  await page.locator('.pref', { hasText: 'Font size' }).locator('select').selectOption('medium');
  await page.locator('.pref', { hasText: 'Items per page' }).locator('input').fill('25');
  await page.locator('.pref', { hasText: 'Items per page' }).locator('input').blur();
});
