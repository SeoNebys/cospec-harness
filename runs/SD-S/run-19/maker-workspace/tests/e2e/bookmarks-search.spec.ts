import { expect, test } from '@playwright/test';

test.beforeEach(async ({ request }) => {
  const response = await request.get('/api/bookmarks');
  const { items } = await response.json() as { items: Array<{ id: number }> };
  await Promise.all(items.map(({ id }) => request.delete(`/api/bookmarks/${id}`)));
  await request.post('/api/bookmarks', { data: { url: 'https://design.example/guide', title: 'Design guide', description: 'A practical reference', tags: ['Research', 'UX'] } });
  await request.post('/api/bookmarks', { data: { url: 'https://cooking.example/soup', title: 'Weekend soup', description: 'Warm and simple', tags: ['Weekend', 'research'] } });
});

test('searches every field, combines a tag, and clears criteria', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-harness-ready="true"]')).toBeVisible();
  const search = page.getByLabel('Search bookmarks');

  await search.fill('PRACTICAL');
  await expect(page.getByRole('link', { name: 'Design guide' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Weekend soup' })).toBeHidden();

  await search.fill('simple');
  await page.getByLabel('Filter by tag').selectOption({ label: 'Research (2)' });
  await expect(page.getByRole('link', { name: 'Weekend soup' })).toBeVisible();
  await expect(page.getByText('1 result')).toBeVisible();

  await search.fill('missing phrase');
  await expect(page.getByText('No bookmarks match that.')).toBeVisible();
  await page.getByRole('button', { name: 'Clear search and filters' }).click();
  await expect(page.getByRole('link', { name: 'Design guide' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Weekend soup' })).toBeVisible();
});
