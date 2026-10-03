import { expect, test } from '@playwright/test';
import { resetBookmarks } from '../fixtures/bookmarks';

test.beforeEach(() => resetBookmarks());

test('edit, archive, restore, cancel deletion, then delete permanently', async ({ page }, testInfo) => {
  const suffix = testInfo.project.name;
  const original = `Maintain me ${suffix}`;
  const created = await page.request.post('/api/bookmarks', { data: { url: `https://example.com/${suffix}/maintain`, title: original, notes: 'Original', tags: ['Keep'] } });
  const id = (await created.json()).bookmark.id as string;
  expect((await page.request.delete(`/api/bookmarks/${id}`)).status()).toBe(409);
  await page.goto('/');
  const originalCard = page.getByRole('article').filter({ has: page.getByRole('link', { name: original }) });
  await originalCard.getByRole('button', { name: 'Edit' }).click();
  const title = page.getByRole('textbox', { name: 'Title', exact: true });
  await title.fill(`Updated ${suffix}`);
  await page.getByRole('button', { name: 'Save changes' }).click();
  const updatedCard = page.getByRole('article').filter({ has: page.getByRole('link', { name: `Updated ${suffix}` }) });
  await expect(updatedCard).toBeVisible();
  await updatedCard.getByRole('button', { name: 'Archive' }).click();
  await expect(updatedCard).toBeHidden();
  await page.getByRole('navigation', { name: 'Primary' }).getByRole('button', { name: 'Archive' }).click();
  const archivedCard = page.getByRole('article').filter({ has: page.getByRole('link', { name: `Updated ${suffix}` }) });
  await expect(archivedCard).toBeVisible();
  await archivedCard.getByRole('button', { name: 'Restore' }).click();
  await page.getByRole('navigation', { name: 'Primary' }).getByRole('button', { name: 'Bookmarks' }).click();
  const restoredCard = page.getByRole('article').filter({ has: page.getByRole('link', { name: `Updated ${suffix}` }) });
  await expect(restoredCard).toContainText('Keep');
  await restoredCard.getByRole('button', { name: 'Archive' }).click();
  await page.getByRole('navigation', { name: 'Primary' }).getByRole('button', { name: 'Archive' }).click();
  const finalCard = page.getByRole('article').filter({ has: page.getByRole('link', { name: `Updated ${suffix}` }) });
  await finalCard.getByRole('button', { name: 'Delete permanently' }).click();
  await expect(page.getByRole('alertdialog')).toContainText(`Updated ${suffix}`);
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(finalCard).toBeVisible();
  await finalCard.getByRole('button', { name: 'Delete permanently' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Delete permanently' }).click();
  await expect(finalCard).toBeHidden();
});
