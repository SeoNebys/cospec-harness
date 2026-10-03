import { test, expect } from '@playwright/test';
test('entry screen fits a narrow viewport', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto('/');
  await expect(page.locator('body')).toHaveJSProperty('scrollWidth', 320);
  await expect(page.getByLabel('Email address')).toBeVisible();
});
