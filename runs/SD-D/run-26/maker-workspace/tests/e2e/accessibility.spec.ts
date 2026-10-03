import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
test('accessibility: login and library have no serious axe findings', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-harness-ready="true"]')).toBeVisible();
  let results = await new AxeBuilder({ page }).analyze();
  expect(
    results.violations.filter((v) => ['critical', 'serious'].includes(v.impact ?? ''))
  ).toEqual([]);
  await page.getByLabel('Owner password').fill('review-bookmarks');
  await page.getByRole('button', { name: 'Open my library' }).click();
  await expect(
    page.getByRole('heading', { name: /Your library|Read later|Archive/ })
  ).toBeVisible();
  results = await new AxeBuilder({ page }).analyze();
  expect(
    results.violations.filter((v) => ['critical', 'serious'].includes(v.impact ?? ''))
  ).toEqual([]);
});
