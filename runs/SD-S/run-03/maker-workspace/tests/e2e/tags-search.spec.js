import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page, request }) => {
  await request.post('/api/test/reset');
  await request.post('/api/bookmarks', { data: { url: 'https://a.example', title: 'Alpha', tags: ['tech'] } });
  await request.post('/api/bookmarks', { data: { url: 'https://b.example', title: 'Beta', tags: ['tech'] } });
  await request.post('/api/bookmarks', { data: { url: 'https://c.example', title: 'Gamma', tags: ['news'] } });
  await page.goto('/');
  await expect(page.locator('#app')).toHaveAttribute('data-harness-ready', 'true');
});

test('filters by tag', async ({ page }) => {
  await expect(page.locator('.bookmark')).toHaveCount(3);
  await page.locator('.tag-filter', { hasText: 'tech' }).click();
  await expect(page.locator('.bookmark')).toHaveCount(2);
  await expect(page.locator('.bookmark__title').filter({ hasText: 'Gamma' })).toHaveCount(0);
});

test('searches by keyword across title', async ({ page }) => {
  await page.fill('#search', 'gamma');
  await expect(page.locator('.bookmark')).toHaveCount(1);
  await expect(page.locator('.bookmark__title')).toHaveText('Gamma');
});

test('shows a no-results state for a non-matching query', async ({ page }) => {
  await page.fill('#search', 'zzzznope');
  await expect(page.locator('#no-results')).toBeVisible();
  await expect(page.locator('.bookmark')).toHaveCount(0);
  await expect(page.locator('#empty-state')).toBeHidden();
});
