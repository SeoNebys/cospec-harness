import AxeBuilder from '@axe-core/playwright';
import { test, expect } from '@playwright/test';
test('library and create form have no automatically detectable accessibility violations', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.locator('[data-harness-ready="true"]')).toBeVisible();
  expect((await new AxeBuilder({ page: page as never }).analyze()).violations).toEqual([]);
  await page.getByRole('button', { name: /Save a link/ }).click();
  await expect(page.getByRole('heading', { name: /Save something/ })).toBeVisible();
  expect((await new AxeBuilder({ page: page as never }).analyze()).violations).toEqual([]);
});
