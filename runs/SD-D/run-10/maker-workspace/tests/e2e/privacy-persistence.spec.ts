import { expect, test } from '@playwright/test';
import { saveBookmark, signIn } from './helpers';

test('shows a recoverable stale-edit conflict across two sessions', async ({ browser, page }, testInfo) => {
  const suffix = `${testInfo.project.name}-${Date.now()}`;
  const title = `Concurrent ${suffix}`;
  await signIn(page);
  await saveBookmark(page, { url: `https://example.com/concurrent-${suffix}`, title });
  await page.getByRole('button', { name: `View details for ${title}` }).click();
  await page.getByRole('button', { name: 'Edit details' }).click();
  const firstEditor = page.getByRole('dialog', { name: 'Edit bookmark' });
  await firstEditor.getByRole('textbox', { name: /^Title/ }).fill(`${title} first`);

  const context = await browser.newContext();
  const secondPage = await context.newPage();
  await signIn(secondPage);
  await secondPage.getByLabel('Search bookmarks').fill(`"${title}"`);
  await secondPage.getByRole('button', { name: `View details for ${title}` }).click();
  await secondPage.getByRole('button', { name: 'Edit details' }).click();
  const secondEditor = secondPage.getByRole('dialog', { name: 'Edit bookmark' });
  await secondEditor.getByRole('textbox', { name: /^Title/ }).fill(`${title} second`);
  await secondEditor.getByRole('button', { name: 'Save changes' }).click();
  await firstEditor.getByRole('button', { name: 'Save changes' }).click();
  await expect(
    page.getByRole('alertdialog', { name: 'This bookmark changed in another session.' }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Keep my unsaved edits' })).toBeVisible();
  await context.close();
});
