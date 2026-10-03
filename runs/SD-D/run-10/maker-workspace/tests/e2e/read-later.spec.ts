import { expect, test } from '@playwright/test';
import { navigate, saveBookmark, signIn } from './helpers';

test('Read Later is independent from Favorites and marking read removes the item', async ({
  page,
}, testInfo) => {
  const started = Date.now();
  const suffix = `${testInfo.project.name}-${Date.now()}`;
  const title = `Read later ${suffix}`;
  await signIn(page);
  await saveBookmark(page, {
    url: `https://example.com/read-${suffix}`,
    title,
    readLater: true,
    favorite: true,
  });
  await navigate(page, 'Read Later');
  await expect(page.getByRole('button', { name: `View details for ${title}` })).toBeVisible();
  await page
    .getByRole('button', { name: `View details for ${title}` })
    .locator('..')
    .getByRole('button', { name: '✓ Read' })
    .click();
  await expect(page.getByRole('button', { name: `View details for ${title}` })).toBeHidden();
  await navigate(page, 'Favorites');
  await expect(page.getByRole('button', { name: `View details for ${title}` })).toBeVisible();
  expect(Date.now() - started).toBeLessThan(20_000);
});
