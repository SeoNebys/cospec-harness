import { test, expect } from '@playwright/test';

// US1 — save a bookmark; edited title persists (metadata fetch is best-effort
// and network-dependent, so this test supplies the title directly).
test('save a bookmark and see it in the list', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('body[data-harness-ready="true"]')).toBeVisible();

  await page.getByRole('button', { name: '+ Save bookmark' }).click();
  const url = `https://e2e.test/save-${Date.now()}`;
  await page.getByPlaceholder('https://example.com/article').fill(url);
  await page.getByPlaceholder('Title').fill('E2E Saved Title');
  await page.getByRole('button', { name: 'Save bookmark', exact: true }).click();

  await expect(page.getByRole('link', { name: 'E2E Saved Title' })).toBeVisible();
});

// US4 — invalid URL is rejected with a message.
test('rejects an invalid address', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '+ Save bookmark' }).click();
  await page.getByPlaceholder('https://example.com/article').fill('not-a-url');
  await page.getByRole('button', { name: 'Save bookmark', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText(/valid web address/i);
});
