import { test, expect } from '@playwright/test';
import { createBookmark, removeBookmark } from './helpers';
test('explicit bulk selection reports and applies organization actions', async ({ page, request }) => {
  const stamp = Date.now();
  const one = await createBookmark(request, `Bulk A ${stamp}`);
  const two = await createBookmark(request, `Bulk B ${stamp}`);
  await page.goto('/');
  await page.getByRole('checkbox', { name: `Select Bulk A ${stamp}` }).check();
  await page.getByRole('checkbox', { name: `Select Bulk B ${stamp}` }).check();
  await expect(page.getByText('2 selected')).toBeVisible();
  await page.getByRole('button', { name: 'Mark unread' }).last().click();
  await expect(page.getByText(/2 changed/)).toBeAttached();
  await removeBookmark(request, one.id);
  await removeBookmark(request, two.id);
});
