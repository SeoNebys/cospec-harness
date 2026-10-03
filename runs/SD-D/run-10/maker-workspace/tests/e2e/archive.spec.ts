import { expect, test } from '@playwright/test';
import { navigate, saveBookmark, signIn } from './helpers';

test('archives, restores, and permanently deletes through distinct actions', async ({ page }, testInfo) => {
  const suffix = `${testInfo.project.name}-${Date.now()}`;
  const title = `Archive ${suffix}`;
  await signIn(page);
  await saveBookmark(page, { url: `https://example.com/archive-${suffix}`, title, readLater: true });
  await page.getByRole('button', { name: `View details for ${title}` }).click();
  await page
    .getByRole('dialog', { name: title })
    .getByRole('button', { name: /Archive/ })
    .click();
  await navigate(page, 'Archive');
  await page.getByRole('button', { name: `View details for ${title}` }).click();
  await page
    .getByRole('dialog', { name: title })
    .getByRole('button', { name: /Restore/ })
    .click();
  await navigate(page, 'Read Later');
  await expect(page.getByRole('button', { name: `View details for ${title}` })).toBeVisible();
  await page.getByRole('button', { name: `View details for ${title}` }).click();
  await page.getByRole('button', { name: /Delete/ }).click();
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByRole('dialog', { name: title })).toBeVisible();
  await page
    .getByRole('dialog', { name: title })
    .getByRole('button', { name: /Delete/ })
    .click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Delete permanently' }).click();
  await expect(page.getByRole('dialog', { name: title })).toBeHidden();
});
