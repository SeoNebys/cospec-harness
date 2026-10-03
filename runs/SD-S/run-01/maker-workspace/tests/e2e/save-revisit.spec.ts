import { expect, test } from '@playwright/test';
import { resetBookmarks } from '../fixtures/bookmarks';

test.beforeEach(() => resetBookmarks());

test('save, revisit, validate, and explicitly duplicate a bookmark', async ({ page }, testInfo) => {
  const suffix = testInfo.project.name;
  const address = `https://example.com/${suffix}/guide`;
  const title = `Useful guide ${suffix}`;
  await page.goto('/');
  await expect(page.locator('[data-harness-ready="true"]')).toBeVisible();
  await page.getByRole('button', { name: /add bookmark/i }).click();
  await page.getByLabel('Web address').fill(address);
  await page.getByRole('textbox', { name: 'Title', exact: true }).fill(title);
  await page.getByRole('textbox', { name: /Notes/ }).fill('Worth revisiting');
  await page.getByRole('textbox', { name: /Tags/ }).fill('Research');
  await page.getByRole('textbox', { name: /Tags/ }).press('Enter');
  await page.getByRole('button', { name: 'Save bookmark' }).click();
  const savedLink = page.getByRole('link', { name: title });
  await expect(savedLink).toBeVisible();
  await expect(savedLink).toHaveAttribute('target', '_blank');
  await page.reload();
  await expect(page.getByRole('link', { name: title })).toBeVisible();

  await page.getByRole('button', { name: /add bookmark/i }).click();
  await page.getByLabel('Web address').fill('not a url');
  await page.getByRole('button', { name: 'Save bookmark' }).click();
  await expect(page.getByText(/complete web address/i)).toBeVisible();
  await expect(page.getByLabel('Web address')).toHaveValue('not a url');
  await page.getByLabel('Web address').fill(address);
  await page.getByRole('textbox', { name: 'Title', exact: true }).fill(`Duplicate ${suffix}`);
  await page.getByRole('button', { name: 'Save bookmark' }).click();
  await expect(page.getByRole('alertdialog')).toContainText('already');
  await page.getByRole('button', { name: 'Keep existing' }).click();
  await expect(page.getByRole('alertdialog')).toBeHidden();
  await page.getByRole('button', { name: 'Save bookmark' }).click();
  await page.getByRole('button', { name: 'Save another copy' }).click();
  await expect(page.getByRole('link', { name: `Duplicate ${suffix}` })).toBeVisible();
});
