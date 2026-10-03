import { test, expect } from '@playwright/test';
import { createBookmark } from './helpers';
test('archive is reversible and permanent deletion requires confirmation', async ({ page, request }) => {
  const stamp = Date.now();
  const bookmark = await createBookmark(request, `Lifecycle ${stamp}`, { tagLabels: ['Keep'] });
  await page.goto('/');
  const archiveNav = () =>
    page.getByRole('navigation', { name: 'Bookmark views' }).getByRole('button', { name: /Archive/ });
  let card = page.getByRole('article').filter({ hasText: `Lifecycle ${stamp}` });
  await card.getByRole('button', { name: 'Archive' }).click();
  await archiveNav().click();
  card = page.getByRole('article').filter({ hasText: `Lifecycle ${stamp}` });
  await expect(card).toContainText('#Keep');
  await card.getByRole('button', { name: 'Restore' }).click();
  await request.post('/api/bookmarks/bulk-actions', {
    data: { bookmarkIds: [bookmark.id], action: 'archive' },
  });
  await page.reload();
  await archiveNav().click();
  card = page.getByRole('article').filter({ hasText: `Lifecycle ${stamp}` });
  await card.getByRole('button', { name: 'Delete permanently' }).click();
  await expect(page.getByText(/cannot be undone/i)).toBeVisible();
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(card).toBeVisible();
  await card.getByRole('button', { name: 'Delete permanently' }).click();
  await page.getByRole('button', { name: 'Delete permanently' }).last().click();
  await expect(card).toBeHidden();
});
