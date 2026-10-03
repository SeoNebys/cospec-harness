import { test, expect } from '@playwright/test';
test('sign-in is keyboard reachable and labeled', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-harness-ready="true"]')).toBeVisible();
  await expect(page.getByLabel('Email address')).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(page.locator(':focus')).toBeVisible();
});
