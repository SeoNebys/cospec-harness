import { test, expect } from '@playwright/test';
import { createBookmark, removeBookmark } from './helpers';
test('read-later is explicit and opening is not coupled to state', async ({ page, request }) => {
  const title = `Read later ${Date.now()}`;
  const bookmark = await createBookmark(request, title, { readingState: 'unread' });
  await page.goto('/');
  await page
    .getByRole('navigation', { name: 'Bookmark views' })
    .getByRole('button', { name: /Read later/ })
    .click();
  await expect(page.getByRole('heading', { name: 'Your reading queue' })).toBeVisible();
  const card = page.getByRole('article').filter({ hasText: title });
  await expect(card).toBeVisible();
  await card.getByRole('button', { name: 'Mark read' }).click();
  await expect(card).toBeHidden();
  await removeBookmark(request, bookmark.id);
});
