import { test, expect } from '@playwright/test';
import { seedBookmark } from './helpers.js';

test('saved search with included and excluded tags restores and runs', async ({ page, request }) => {
  await seedBookmark(request, { url: 'https://ss-1.example', title: 'Recipe Keep', tags: ['recipes'] });
  await seedBookmark(request, { url: 'https://ss-2.example', title: 'Recipe Tried', tags: ['recipes', 'tried'] });

  // Create the saved search directly (include recipes, exclude tried).
  await request.post('/api/saved-searches', {
    data: { name: 'To Cook', include_tags: ['recipes'], exclude_tags: ['tried'], view_scope: 'normal', sort: 'date_added_desc' },
  });

  await page.goto('/');
  await page.locator('.saved-open', { hasText: 'To Cook' }).click();
  await expect(page.locator('.context-label')).toContainText('Saved: To Cook');
  // Only the non-"tried" recipe remains.
  await expect(page.locator('.card', { hasText: 'Recipe Keep' })).toBeVisible();
  await expect(page.locator('.card', { hasText: 'Recipe Tried' })).toHaveCount(0);

  // Delete persists.
  page.on('dialog', (d) => d.accept());
  await page
    .locator('.saved-item', { hasText: 'To Cook' })
    .locator('button.mini', { hasText: '×' })
    .click();
  await expect(page.locator('.saved-open', { hasText: 'To Cook' })).toHaveCount(0);
});
