import { test, expect } from '@playwright/test';

test('edits archives restores and confirms deletion', async ({ page, request }, info) => {
  const title = `Maintain ${Date.now()} ${info.project.name}`;
  await request.post('/api/bookmarks', { data: { url: `https://maintain-${Date.now()}-${info.project.name}.example.com`, title, tags: [], favorite: false } });
  await page.goto('/');
  const card = page.getByRole('article').filter({ hasText: title });
  await card.getByRole('button', { name: 'Edit', exact: true }).click();
  await page.getByRole('dialog').getByLabel('Title').fill(`${title} edited`);
  await page.getByRole('dialog').getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('heading', { name: `${title} edited` })).toBeVisible();
  await page.getByRole('article').filter({ hasText: `${title} edited` }).getByRole('button', { name: 'Archive' }).click();
  await page.getByRole('navigation', { name: 'Library views' }).getByRole('button', { name: 'Archive', exact: true }).click();
  await page.getByRole('article').filter({ hasText: `${title} edited` }).getByRole('button', { name: 'Restore' }).click();
  await page.getByRole('navigation', { name: 'Library views' }).getByRole('button', { name: 'Bookmarks', exact: true }).click();
  const restored = page.getByRole('article').filter({ hasText: `${title} edited` });
  await restored.getByRole('button', { name: 'Delete' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click();
  await expect(restored).toBeVisible();
  await restored.getByRole('button', { name: 'Delete' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete permanently' }).click();
  await expect(page.getByRole('heading', { name: `${title} edited` })).toHaveCount(0);
});
