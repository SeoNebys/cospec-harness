import { test, expect } from '@playwright/test';

// US2 — search narrows the list; a malformed query shows a clear message.
test('search filters the visible bookmarks', async ({ page }) => {
  const stamp = Date.now();
  // Seed two bookmarks via the API.
  await page.request.post('/api/bookmarks', {
    data: { url: `https://e2e.test/alpha-${stamp}`, title: `Alpha ${stamp}` },
  });
  await page.request.post('/api/bookmarks', {
    data: { url: `https://e2e.test/beta-${stamp}`, title: `Beta ${stamp}` },
  });

  await page.goto('/');
  await expect(page.locator('body[data-harness-ready="true"]')).toBeVisible();

  await page.getByRole('searchbox').fill(`Alpha ${stamp}`);
  await expect(page.getByRole('link', { name: `Alpha ${stamp}` })).toBeVisible();
  await expect(page.getByRole('link', { name: `Beta ${stamp}` })).toHaveCount(0);
});

test('malformed query shows an error', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('body[data-harness-ready="true"]')).toBeVisible();
  await page.getByRole('searchbox').fill('(a OR b');
  await expect(page.getByRole('alert')).toContainText(/parenthes/i);
});
