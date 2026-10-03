import { test, expect } from '@playwright/test';

// End-to-end flows over the real app (FR core loop). The webServer is started by
// playwright.config.js. Each test seeds via the API for determinism.

async function reset(request) {
  // Delete everything so tests are independent.
  const res = await request.get('/api/bookmarks?page_size=1000&view=active');
  const active = (await res.json()).items;
  const arch = (await (await request.get('/api/bookmarks?page_size=1000&view=archive')).json()).items;
  for (const b of [...active, ...arch]) {
    await request.delete(`/api/bookmarks/${b.id}`);
  }
}

test('app loads and marks harness ready', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-harness-ready="true"]')).toBeVisible();
});

test('save, search, and open a bookmark', async ({ page, request }) => {
  await reset(request);
  await request.post('/api/bookmarks', {
    data: { url: 'https://example.com/', title: 'Example Site', tags: ['demo'] },
  });
  await page.goto('/');
  await expect(page.locator('.bookmark .title', { hasText: 'Example Site' })).toBeVisible();

  // Search narrows the list.
  await page.fill('#search-box', 'nonexistent-term-xyz');
  await expect(page.locator('#empty-state')).toBeVisible();
  await page.fill('#search-box', 'Example');
  await expect(page.locator('.bookmark .title', { hasText: 'Example Site' })).toBeVisible();

  // Opening the title targets a new tab.
  const link = page.locator('.bookmark .title');
  await expect(link).toHaveAttribute('target', '_blank');
  await expect(link).toHaveAttribute('href', 'https://example.com/');
});

test('archive removes from active and shows in archive view', async ({ page, request }) => {
  await reset(request);
  const created = await (
    await request.post('/api/bookmarks', { data: { url: 'https://arch.test/1', title: 'Archive Me' } })
  ).json();
  await page.goto('/');
  await page.locator('.bookmark', { hasText: 'Archive Me' }).getByRole('button', { name: 'Archive' }).click();
  await expect(page.locator('.bookmark', { hasText: 'Archive Me' })).toHaveCount(0);
  await page.locator('.view-link[data-view="archive"]').click();
  await expect(page.locator('.bookmark', { hasText: 'Archive Me' })).toBeVisible();
});

test('bulk select-all-matching archives the whole current view', async ({ page, request }) => {
  await reset(request);
  for (let i = 0; i < 5; i++) {
    await request.post('/api/bookmarks', { data: { url: `https://bulk.test/${i}`, title: `B${i}`, tags: ['bulk'] } });
  }
  await page.goto('/');
  await expect(page.locator('.bookmark')).toHaveCount(5);
  await page.check('#select-all-matching');
  await page.locator('#bulk-bar button[data-bulk="archive"]').click();
  await expect(page.locator('.bookmark')).toHaveCount(0);
  await page.locator('.view-link[data-view="archive"]').click();
  await expect(page.locator('.bookmark')).toHaveCount(5);
});
