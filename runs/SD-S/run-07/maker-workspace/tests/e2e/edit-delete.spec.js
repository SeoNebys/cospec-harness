import { test, expect } from '@playwright/test';

test('edit a title (persists after reload) and delete with confirmation', async ({
  page,
}) => {
  const stamp = Date.now();
  const url = `https://e2e-edit-${stamp}.example.com/x`;
  const title = `E2E Edit ${stamp}`;
  const newTitle = `${title} Updated`;

  await page.goto('/');
  await expect(page.locator('#app')).toHaveAttribute('data-harness-ready', 'true');
  await page.fill('#url-input', url);
  await page.fill('#title-input', title);
  await page.click('#save-btn');

  // Locate the saved bookmark by its unique title.
  await page.fill('#search-input', title);
  const item = page.locator('#bookmark-list .bookmark').first();
  await expect(item.locator('.bookmark-title')).toHaveText(title);

  // Edit the title.
  await item.getByRole('button', { name: 'Edit' }).click();
  const editForm = item.locator('.edit-form');
  await editForm.locator('input[aria-label="Edit title"]').fill(newTitle);
  await editForm.getByRole('button', { name: 'Save' }).click();

  await page.fill('#search-input', newTitle);
  await expect(
    page.locator('#bookmark-list .bookmark').first().locator('.bookmark-title')
  ).toHaveText(newTitle);

  // Reload: the edit persisted.
  await page.reload();
  await expect(page.locator('#app')).toHaveAttribute('data-harness-ready', 'true');
  await page.fill('#search-input', newTitle);
  await expect(
    page.locator('#bookmark-list .bookmark').first().locator('.bookmark-title')
  ).toHaveText(newTitle);

  // Delete with confirmation.
  page.once('dialog', (dialog) => dialog.accept());
  await page
    .locator('#bookmark-list .bookmark')
    .first()
    .getByRole('button', { name: 'Delete' })
    .click();

  await page.fill('#search-input', newTitle);
  await expect(page.locator('#no-results')).toBeVisible();
});
