import { expect, test } from '@playwright/test';
import { navigate, signIn } from './helpers';

test('uses reusable multi-tags as the primary organizer with an optional collection', async ({
  page,
}, testInfo) => {
  const suffix = `${testInfo.project.name}-${Date.now()}`;
  const tag = `research-${suffix}`;
  const collection = `Reference ${suffix}`;
  await signIn(page);
  await navigate(page, 'Tags');
  await page.getByLabel('New tag name').fill(tag);
  await page.getByRole('button', { name: 'Create tag' }).click();
  await expect(page.getByRole('button', { name: `#${tag}` })).toBeVisible();
  await navigate(page, 'Collections');
  await page.getByLabel('New collection name').fill(collection);
  await page.getByRole('button', { name: 'Create collection' }).click();
  await expect(page.getByRole('button', { name: collection })).toBeVisible();
  await navigate(page, 'Library');
  await page.getByRole('button', { name: /Add bookmark/ }).click();
  const editor = page.getByRole('dialog', { name: 'Save a bookmark' });
  await editor.getByLabel('Web address').fill(`https://example.com/organization-${suffix}`);
  await editor.getByRole('textbox', { name: /^Title/ }).fill(`Organized ${suffix}`);
  await editor.getByLabel('Tags').fill(tag.slice(0, 8));
  await expect(editor.getByRole('option', { name: `#${tag}` })).toBeVisible();
  await editor.getByRole('option', { name: `#${tag}` }).click();
  await editor.getByLabel(/Collection/).selectOption({ label: collection });
  await editor.getByText('Favorite', { exact: true }).click();
  await editor.getByRole('button', { name: 'Keep this bookmark' }).click();
  await expect(page.getByRole('dialog')).toContainText(`#${tag}`);
  await expect(page.getByRole('dialog')).toContainText(collection);
});
