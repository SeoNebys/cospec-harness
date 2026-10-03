import { expect, test } from '@playwright/test';

test.beforeEach(async ({ request }) => {
  const response = await request.get('/api/bookmarks');
  const { items } = await response.json() as { items: Array<{ id: number }> };
  await Promise.all(items.map(({ id }) => request.delete(`/api/bookmarks/${id}`)));
  await request.post('/api/bookmarks', { data: { url: 'https://one.example/', title: 'First bookmark', description: 'Before editing', tags: ['Old'] } });
  await request.post('/api/bookmarks', { data: { url: 'https://two.example/', title: 'Second bookmark', description: null, tags: ['Keep'] } });
});

test('edits persist, invalid edits roll back, duplicates warn, and deletion confirms', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-harness-ready="true"]')).toBeVisible();

  await page.getByRole('button', { name: 'Edit First bookmark' }).click();
  const editForm = page.getByRole('form', { name: 'Edit First bookmark' });
  await editForm.getByLabel('Web address').fill('file:///tmp/nope');
  await editForm.getByRole('button', { name: 'Save changes' }).click();
  await expect(editForm.getByRole('alert')).toContainText('Only http:// and https://');

  await editForm.getByLabel('Web address').fill('https://updated.example/article');
  await editForm.getByLabel('Title').fill('Updated bookmark');
  await editForm.getByLabel(/Description/).fill('After editing');
  await editForm.getByLabel(/Tags/).fill('Fresh, Research');
  await editForm.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('link', { name: 'Updated bookmark' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('link', { name: 'Updated bookmark' })).toBeVisible();
  await expect(page.getByText('After editing')).toBeVisible();

  await page.getByRole('button', { name: 'Edit Second bookmark' }).click();
  const secondForm = page.getByRole('form', { name: 'Edit Second bookmark' });
  await secondForm.getByLabel('Web address').fill('https://updated.example/article');
  await secondForm.getByRole('button', { name: 'Save changes' }).click();
  await expect(secondForm.getByText(/another bookmark uses this address/i)).toBeVisible();
  await secondForm.getByRole('button', { name: 'Update anyway' }).click();
  await expect(page.getByRole('link', { name: 'Second bookmark' })).toBeVisible();

  const deleteButton = page.getByRole('button', { name: 'Delete Updated bookmark' });
  await deleteButton.click();
  await expect(page.getByRole('alertdialog')).toBeVisible();
  await page.getByRole('button', { name: 'Keep bookmark' }).click();
  await expect(deleteButton).toBeFocused();
  await deleteButton.click();
  await page.getByRole('button', { name: 'Delete permanently' }).click();
  await expect(page.getByRole('link', { name: 'Updated bookmark' })).toHaveCount(0);
});
