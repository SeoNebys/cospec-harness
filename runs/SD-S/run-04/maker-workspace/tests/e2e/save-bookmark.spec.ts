import { test, expect } from '@playwright/test';
test('automatic title suggestion, save, and duplicate warning', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /create an account/i }).click();
  await page.getByLabel('Email address').fill(`save-${Date.now()}@example.com`);
  await page.getByLabel('Password').fill('correct horse battery staple');
  await page.getByRole('button', { name: 'Create account' }).click();
  await page.getByRole('button', { name: /add bookmark/i }).click();
  await page.route('**/api/title-previews', (route) =>
    route.fulfill({ json: { status: 'found', title: 'The automatic title' } }),
  );
  await page.getByLabel(/web address/i).fill('https://example.com/story');
  await page.getByLabel(/web address/i).blur();
  await expect(page.getByLabel(/title/i)).toHaveValue('The automatic title');
  await page.getByLabel(/tags/i).fill('Reading, Ideas');
  await page.getByRole('button', { name: 'Save bookmark' }).click();
  await expect(page.getByRole('link', { name: /The automatic title/ })).toBeVisible();
  await page.getByRole('button', { name: /add bookmark/i }).click();
  await page.getByLabel(/web address/i).fill('https://example.com/story#again');
  await page.getByLabel(/title/i).fill('Duplicate');
  await page.getByRole('button', { name: 'Save bookmark' }).click();
  await expect(page.getByText(/saved this before/i)).toBeVisible();
});
