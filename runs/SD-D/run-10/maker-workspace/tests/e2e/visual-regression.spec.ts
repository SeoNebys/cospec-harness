import { expect, test } from '@playwright/test';
import { navigate, signIn } from './helpers';

test('captures accessible primary views at the configured desktop and phone viewport', async ({
  page,
}, testInfo) => {
  await signIn(page);
  for (const name of [
    'Library',
    'Read Later',
    'Favorites',
    'Archive',
    'Tags',
    'Collections',
    'Saved Searches',
  ]) {
    await navigate(page, name);
    await expect(page.locator('[data-harness-ready="true"]')).toBeVisible();
    await testInfo.attach(`${name.toLowerCase().replaceAll(' ', '-')}.png`, {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
  }
});
