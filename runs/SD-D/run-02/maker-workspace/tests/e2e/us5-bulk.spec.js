import { test, expect } from '@playwright/test';
import { seedBookmark } from './helpers.js';

test('bulk "apply to all matching" affects the whole result set across pages', async ({ page, request }) => {
  // 30 bookmarks with a unique tag -> spans multiple pages at the default page size.
  for (let i = 0; i < 30; i++) {
    await seedBookmark(request, { url: `https://bulkspan.example/${i}`, title: `Span ${i}`, tags: ['bulkspan'] });
  }
  await page.goto('/');

  // Filter to the tag and confirm pagination exists (more than one page).
  await page.locator('.side-tag', { hasText: 'bulkspan' }).click();
  await expect(page.locator('.context-label')).toContainText('#bulkspan');
  await expect(page.locator('.pager')).toBeVisible();
  await expect(page.locator('.context-row .muted')).toContainText('30');

  // Apply "archive" to ALL matching this view (not just the visible page).
  await page.getByText('All matching this view').click();
  await page.locator('.bulk-actions').getByRole('button', { name: 'Archive', exact: true }).click();

  // The whole filtered set is archived -> nothing left in the normal+tag view.
  await expect(page.locator('.empty-state')).toBeVisible();

  // And all 30 are now in the archived view under that tag.
  await page.getByRole('button', { name: 'Archived', exact: true }).click();
  await page.locator('.side-tag', { hasText: 'bulkspan' }).click();
  await expect(page.locator('.context-row .muted')).toContainText('30');
});

test('bulk action on the selected set only', async ({ page, request }) => {
  const a = await seedBookmark(request, { url: 'https://sel-a.example', title: 'SelA', tags: ['selgroup'] });
  await seedBookmark(request, { url: 'https://sel-b.example', title: 'SelB', tags: ['selgroup'] });
  await page.goto('/');
  await page.locator('.side-tag', { hasText: 'selgroup' }).click();

  // Select only SelA and mark it read via the selected-set scope.
  await page.locator('.card', { hasText: 'SelA' }).locator('.card-select').check();
  await page.locator('.bulk-actions').getByRole('button', { name: 'Mark read' }).click();

  // SelA is now read (no unread badge); SelB remains unread.
  await expect(page.locator('.card', { hasText: 'SelA' }).locator('.badge.unread')).toHaveCount(0);
  await expect(page.locator('.card', { hasText: 'SelB' }).locator('.badge.unread')).toBeVisible();
});
