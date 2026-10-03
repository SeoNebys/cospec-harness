import { test, expect } from '@playwright/test';
test('pasting a URL fetches editable details and saves with fallback resilience', async ({
  page,
  request,
}) => {
  test.setTimeout(60_000);
  const unique = Date.now();
  const finalTitle = `My fetched bookmark ${unique}`;
  const url = `https://example.com/?pinboard=${unique}`;
  await page.goto('/');
  await page.getByRole('button', { name: /Save a link/ }).click();
  await page.getByLabel('Web address').fill(url);
  await page.getByRole('button', { name: 'Fetch details' }).click();
  await expect(page.getByText('Details ready to edit')).toBeVisible({ timeout: 12_000 });
  const title = page.getByLabel('Title');
  await expect(title).not.toHaveValue('');
  await title.fill(finalTitle);
  await page.getByLabel('Read later', { exact: true }).selectOption('unread');
  const tag = page.getByRole('combobox', { name: 'Add tags' });
  await tag.fill('E2E Research');
  await tag.press('Enter');
  await page.locator('.tiptap').fill('A note worth finding later');
  await page.getByRole('button', { name: 'Save bookmark' }).click();
  await expect(page.getByRole('heading', { name: finalTitle })).toBeVisible();
  await page
    .getByRole('navigation', { name: 'Bookmark views' })
    .getByRole('button', { name: /Read later/ })
    .click();
  await expect(page.getByRole('heading', { name: finalTitle })).toBeVisible();
  const result = await request.get(`/api/bookmarks?q=${encodeURIComponent('"note worth finding"')}`);
  const bookmark = (await result.json()).items.find((item: { title: string }) => item.title === finalTitle);
  expect(bookmark).toBeTruthy();
  await request.post('/api/bookmarks/bulk-actions', {
    data: { bookmarkIds: [bookmark.id], action: 'archive' },
  });
  await request.post('/api/bookmarks/bulk-actions', {
    data: { bookmarkIds: [bookmark.id], action: 'delete', confirmed: true },
  });
});
