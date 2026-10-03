import { expect, test } from '@playwright/test';

test.beforeEach(async ({ request }) => {
  const response = await request.get('/api/bookmarks');
  const { items } = await response.json() as { items: Array<{ id: number }> };
  await Promise.all(items.map(({ id }) => request.delete(`/api/bookmarks/${id}`)));
});

test('saves retrieved and corrected details, then survives reload', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-harness-ready="true"]')).toBeVisible();
  await expect(page.getByText('Nothing saved yet.')).toBeVisible();

  await page.getByLabel('Web address').fill('https://metadata.test/success');
  await page.getByRole('button', { name: 'Get page details' }).click();
  await expect(page.getByLabel('Title')).toHaveValue('The thoughtful web');
  await page.getByLabel('Title').fill('My corrected title');
  await page.getByRole('button', { name: 'Save bookmark' }).click();

  const saved = page.getByRole('link', { name: 'My corrected title' });
  await expect(saved).toBeVisible();
  await expect(saved).toHaveAttribute('target', '_blank');
  await page.reload();
  await expect(page.locator('[data-harness-ready="true"]')).toBeVisible();
  await expect(page.getByRole('link', { name: 'My corrected title' })).toBeVisible();
});

test('uses a fallback title and requires duplicate confirmation', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Web address').fill('https://metadata.test/fallback');
  await page.getByRole('button', { name: 'Get page details' }).click();
  await expect(page.getByText(/could not retrieve page details/i)).toBeVisible();
  await expect(page.getByLabel('Title')).toHaveValue('Fallback · metadata.test');
  await page.getByRole('button', { name: 'Save bookmark' }).click();

  await page.getByLabel('Web address').fill('https://metadata.test/fallback');
  await page.getByRole('button', { name: 'Get page details' }).click();
  await page.getByRole('button', { name: 'Save bookmark' }).click();
  await expect(page.getByText(/already saved this address/i)).toBeVisible();
  await page.getByRole('button', { name: 'Save another copy' }).click();
  await expect(page.getByText('2 bookmarks')).toBeVisible();
});

test('rejects invalid and unsafe addresses with guidance', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Web address').fill('file:///tmp/private');
  await page.getByRole('button', { name: 'Get page details' }).click();
  await expect(page.getByRole('alert')).toContainText('Only http:// and https://');

  await page.getByLabel('Web address').fill('http://127.0.0.1');
  await page.getByRole('button', { name: 'Get page details' }).click();
  await expect(page.getByRole('alert')).toContainText('Local and private network');
});
