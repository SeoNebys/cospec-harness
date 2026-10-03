import { expect, test } from '@playwright/test';
import { saveBookmark, signIn } from './helpers';

test('selects all current matches and confirms an exact-count archive', async ({ page }, testInfo) => {
  const suffix = `${testInfo.project.name}-${Date.now()}`;
  const title = `Bulk target ${suffix}`;
  await signIn(page);
  await saveBookmark(page, { url: `https://example.com/bulk-${suffix}`, title });
  await page.getByLabel('Search bookmarks').fill(`"${title}"`);
  const card = page.getByRole('button', { name: `View details for ${title}` });
  await expect(card).toBeVisible();
  await card.locator('..').getByLabel('Select').check();
  await expect(page.getByText('1 selected', { exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Archive', exact: true }).last().click();
  const confirmation = page.getByRole('alertdialog');
  await expect(confirmation).toContainText('Archive 1 bookmark');
  await confirmation.getByRole('button', { name: 'Archive 1' }).click();
  await expect(page.getByRole('dialog', { name: /changed/ })).toContainText(
    '1 selected bookmarks were accounted for',
  );
});
