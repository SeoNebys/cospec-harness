import { test, expect } from '@playwright/test';

async function seed(request, bookmarks) {
  for (const b of bookmarks) {
    await request.post('/api/bookmarks', { data: b });
  }
}

test.beforeEach(async ({ request }) => {
  await request.post('/api/test/reset');
});

test('shows the empty state when nothing is saved', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#app')).toHaveAttribute('data-harness-ready', 'true');
  await expect(page.locator('#empty-state')).toBeVisible();
  await expect(page.locator('.bookmark')).toHaveCount(0);
});

test('lists saved bookmarks newest first and links open in a new tab', async ({ page, request }) => {
  await seed(request, [
    { url: 'https://first.example', title: 'First' },
    { url: 'https://second.example', title: 'Second' },
  ]);

  await page.goto('/');
  await expect(page.locator('#app')).toHaveAttribute('data-harness-ready', 'true');

  const titles = page.locator('.bookmark__title');
  await expect(titles).toHaveCount(2);
  await expect(titles.nth(0)).toHaveText('Second'); // newest first
  await expect(titles.nth(1)).toHaveText('First');

  // Link opens original page in a new tab.
  const firstLink = titles.nth(0);
  await expect(firstLink).toHaveAttribute('target', '_blank');
  await expect(firstLink).toHaveAttribute('href', 'https://second.example/');
});
